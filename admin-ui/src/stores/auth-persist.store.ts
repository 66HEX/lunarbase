// Persistent Auth Store
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { authApi } from "@/lib/api";
import type { User } from "@/types/api";

interface AuthState {
	user: User | null;
	isAuthenticated: boolean;
	loading: boolean;
	error: string | null;
	refreshTimer: NodeJS.Timeout | null;
}

interface AuthActions {
	login: (email: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
	fetchUser: () => Promise<void>;
	setUser: (user: User) => void;
	clearAuth: () => void;
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	checkAuth: () => Promise<boolean>;
	startTokenRefresh: (expiresIn: number) => void;
	stopTokenRefresh: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
	devtools(
		persist(
			immer((set, get) => ({
				// Initial state
				user: null,
				isAuthenticated: false,
				loading: false,
				error: null,
				refreshTimer: null,

				// Actions
				login: async (email: string, password: string) => {
					set((state) => {
						state.loading = true;
						state.error = null;
					});

					try {
						const loginResponse = await authApi.login({ email, password });

						// Fetch user data to verify authentication
						const userData = await authApi.me();

						set((state) => {
							state.user = userData;
							state.isAuthenticated = true;
							state.loading = false;
							state.error = null;
						});

						// Start proactive token refresh if expires_in is available
						if (loginResponse?.data?.expires_in) {
							get().startTokenRefresh(loginResponse.data.expires_in);
						}
					} catch (error: unknown) {
						const errorMessage =
							error instanceof Error ? error.message : "Login failed";
						set((state) => {
							state.loading = false;
							state.error = errorMessage;
							state.isAuthenticated = false;
							state.user = null;
						});
						throw error;
					}
				},

				logout: async () => {
					set((state) => {
						state.loading = true;
					});

					// Stop token refresh timer
					get().stopTokenRefresh();

					try {
						await authApi.logout();
					} catch {
						// Silently handle logout errors
					} finally {
						// Clear auth state
						set((state) => {
							state.user = null;
							state.isAuthenticated = false;
							state.loading = false;
							state.error = null;
							state.refreshTimer = null;
						});
					}
				},

				checkAuth: async () => {
					try {
						// Try to get user data
						const userData = await authApi.me();

						set((state) => {
							state.user = userData;
							state.isAuthenticated = true;
							state.error = null;
						});
						return true;
					} catch {
						// Clear auth state on error
						set((state) => {
							state.user = null;
							state.isAuthenticated = false;
							state.error = null;
						});
						return false;
					}
				},

				setUser: (user: User) => {
					set((state) => {
						state.user = user;
					});
				},

				fetchUser: async () => {
					try {
						const user = await authApi.me();
						set((state) => {
							state.user = user;
						});
					} catch {
						// Silently handle fetch user errors
					}
				},

				clearAuth: () => {
					// Stop token refresh timer
					get().stopTokenRefresh();

					set((state) => {
						state.user = null;
						state.isAuthenticated = false;
						state.loading = false;
						state.error = null;
						state.refreshTimer = null;
					});
				},

				setLoading: (loading: boolean) => {
					set((state) => {
						state.loading = loading;
					});
				},

				setError: (error: string | null) => {
					set((state) => {
						state.error = error;
					});
				},

				// Token refresh management
				startTokenRefresh: (expiresIn: number) => {
					// Stop any existing timer
					get().stopTokenRefresh();

					// Set refresh timer for 1 minute before expiration
					const refreshTime = Math.max((expiresIn - 60) * 1000, 30000); // Minimum 30 seconds

					const timer = setTimeout(async () => {
						try {
							const refreshResponse = await authApi.refresh();

							// Start next refresh cycle if expires_in is available
							if (refreshResponse?.expires_in) {
								get().startTokenRefresh(refreshResponse.expires_in);
							}
						} catch (error) {
							// If refresh fails, logout user
							console.error("Token refresh failed:", error);
							get().logout();
						}
					}, refreshTime);

					set((state) => {
						state.refreshTimer = timer;
					});
				},

				stopTokenRefresh: () => {
					const { refreshTimer } = get();
					if (refreshTimer) {
						clearTimeout(refreshTimer);
						set((state) => {
							state.refreshTimer = null;
						});
					}
				},
			})),
			{
				name: "lunarbase-auth-storage",
				partialize: (state) => ({
					user: state.user,
					isAuthenticated: state.isAuthenticated,
				}),
			},
		),
		{
			name: "lunarbase-auth-store",
			enabled: process.env.NODE_ENV === "development",
		},
	),
);
