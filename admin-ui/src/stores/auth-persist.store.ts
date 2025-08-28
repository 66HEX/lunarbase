import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { authApi } from "@/lib/api";
import type { OAuthProvider, User } from "@/types/api";

interface AuthState {
	user: User | null;
	isAuthenticated: boolean;
	loading: boolean;
	error: string | null;
	refreshTimer: NodeJS.Timeout | null;
}

interface AuthActions {
	login: (email: string, password: string) => Promise<void>;
	loginWithOAuth: (provider: string) => Promise<void>;
	getOAuthProviders: () => OAuthProvider[];
	logout: () => Promise<void>;
	fetchUser: () => Promise<void>;
	setUser: (user: User) => void;
	clearAuth: () => void;
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	checkAuth: () => Promise<boolean>;
	startTokenRefresh: (expiresIn: number) => void;
	stopTokenRefresh: () => void;
	forgotPassword: (email: string) => Promise<void>;
	resetPassword: (token: string, newPassword: string) => Promise<void>;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
	devtools(
		persist(
			immer((set, get) => ({
				user: null,
				isAuthenticated: false,
				loading: false,
				error: null,
				refreshTimer: null,

				login: async (email: string, password: string) => {
					set((state) => {
						state.loading = true;
						state.error = null;
					});

					try {
						const loginResponse = await authApi.login({ email, password });

						const userData = await authApi.me();

						set((state) => {
							state.user = userData;
							state.isAuthenticated = true;
							state.loading = false;
							state.error = null;
						});

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

					get().stopTokenRefresh();

					try {
					await authApi.logout();
				} catch {
					// Silently ignore logout errors - cleanup happens in finally block
				} finally {
						set((state) => {
							state.user = null;
							state.isAuthenticated = false;
							state.loading = false;
							state.error = null;
							state.refreshTimer = null;
						});
					}
				},

				loginWithOAuth: async (provider: string) => {
					set((state) => {
						state.loading = true;
						state.error = null;
					});

					try {
						const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
						window.location.href = `${API_BASE_URL}/auth/oauth/${provider}`;
					} catch (error: unknown) {
						const errorMessage =
							error instanceof Error ? error.message : "OAuth login failed";
						set((state) => {
							state.loading = false;
							state.error = errorMessage;
						});
						throw error;
					}
				},

				getOAuthProviders: () => {
					return authApi.getOAuthProviders();
				},

				checkAuth: async () => {
					try {
						const userData = await authApi.me();

						set((state) => {
							state.user = userData;
							state.isAuthenticated = true;
							state.error = null;
						});
						return true;
					} catch {
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
					// Silently ignore fetch user errors - user state remains unchanged
				}
				},

				clearAuth: () => {
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

				startTokenRefresh: (expiresIn: number) => {
					get().stopTokenRefresh();

					const refreshTime = Math.max((expiresIn - 60) * 1000, 30000);

					const timer = setTimeout(async () => {
						try {
							const refreshResponse = await authApi.refresh();

							if (refreshResponse?.expires_in) {
								get().startTokenRefresh(refreshResponse.expires_in);
							}
						} catch (error) {
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

				forgotPassword: async (email: string) => {
					set((state) => {
						state.loading = true;
						state.error = null;
					});

					try {
						await authApi.forgotPassword({ email });
						set((state) => {
							state.loading = false;
						});
					} catch (error: unknown) {
						const errorMessage =
							error instanceof Error
								? error.message
								: "Failed to send reset email";
						set((state) => {
							state.loading = false;
							state.error = errorMessage;
						});
						throw error;
					}
				},

				resetPassword: async (token: string, newPassword: string) => {
					set((state) => {
						state.loading = true;
						state.error = null;
					});

					try {
						await authApi.resetPassword({ token, new_password: newPassword });
						set((state) => {
							state.loading = false;
						});
					} catch (error: unknown) {
						const errorMessage =
							error instanceof Error
								? error.message
								: "Failed to reset password";
						set((state) => {
							state.loading = false;
							state.error = errorMessage;
						});
						throw error;
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
