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
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
	devtools(
		persist(
			immer((set) => ({
				// Initial state
				user: null,
				isAuthenticated: false,
				loading: false,
				error: null,

				// Actions
				login: async (email: string, password: string) => {
					set((state) => {
						state.loading = true;
						state.error = null;
					});

					try {
						await authApi.login({ email, password });

						// Fetch user data to verify authentication
						const userData = await authApi.me();

						set((state) => {
							state.user = userData;
							state.isAuthenticated = true;
							state.loading = false;
							state.error = null;
						});
					} catch (error: any) {
						set((state) => {
							state.loading = false;
							state.error = error.message || "Login failed";
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

					try {
						await authApi.logout();
					} catch (error) {
						// Silently handle logout errors
					} finally {
						// Clear auth state
						set((state) => {
							state.user = null;
							state.isAuthenticated = false;
							state.loading = false;
							state.error = null;
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
					} catch (error) {
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
					} catch (error) {
						// Silently handle fetch user errors
					}
				},

				clearAuth: () => {
					set((state) => {
						state.user = null;
						state.isAuthenticated = false;
						state.loading = false;
						state.error = null;
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
