// Persistent Auth Store
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import {
	authApi,
	getAuthToken,
	getRefreshToken,
	removeAuthToken,
	setAuthToken,
	setRefreshToken,
} from "@/lib/api";
import type { User } from "@/types/api";

// Helper function to decode JWT and get expiration time
const getTokenExpiration = (token: string): number | null => {
	try {
		const payload = JSON.parse(atob(token.split(".")[1]));
		return payload.exp * 1000; // Convert to milliseconds
	} catch {
		return null;
	}
};

// Helper function to check if token is about to expire (within 5 minutes)
const isTokenExpiringSoon = (token: string): boolean => {
	const expiration = getTokenExpiration(token);
	if (!expiration) return true;

	const now = Date.now();
	const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
	return expiration - now < fiveMinutes;
};

interface AuthState {
	user: User | null;
	isAuthenticated: boolean;
	accessToken: string | null;
	refreshToken: string | null;
	loading: boolean;
	error: string | null;
}

interface AuthActions {
	login: (email: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
	refreshTokens: () => Promise<boolean>;
	setUser: (user: User) => void;
	setTokens: (accessToken: string, refreshToken: string) => void;
	clearAuth: () => void;
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
	devtools(
		persist(
			immer((set) => ({
				// Initial state
				user: null,
				isAuthenticated: false,
				accessToken: null,
				refreshToken: null,
				loading: false,
				error: null,

				// Actions
				login: async (email: string, password: string) => {
					set((state) => {
						state.loading = true;
						state.error = null;
					});

					try {
						const response = await authApi.login({ email, password });
						const { user, access_token, refresh_token } = response.data;

						// Store tokens
						setAuthToken(access_token);
						setRefreshToken(refresh_token);

						set((state) => {
							state.user = user;
							state.isAuthenticated = true;
							state.accessToken = access_token;
							state.refreshToken = refresh_token;
							state.loading = false;
							state.error = null;
						});
					} catch (error: any) {
						set((state) => {
							state.loading = false;
							state.error = error.message || "Login failed";
							state.isAuthenticated = false;
							state.user = null;
							state.accessToken = null;
							state.refreshToken = null;
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
						console.error("Logout error:", error);
					} finally {
						// Always clear auth state regardless of API call result
						removeAuthToken();
						set((state) => {
							state.user = null;
							state.isAuthenticated = false;
							state.accessToken = null;
							state.refreshToken = null;
							state.loading = false;
							state.error = null;
						});
					}
				},

				refreshTokens: async () => {
					try {
						const refreshTokenValue = getRefreshToken();
						if (!refreshTokenValue) {
							return false;
						}

						const response = await authApi.refresh();
						const { access_token, refresh_token, user } = response;

						// Store new tokens
						setAuthToken(access_token);
						setRefreshToken(refresh_token);

						set((state) => {
							state.accessToken = access_token;
							state.refreshToken = refresh_token;
							state.user = user;
							state.isAuthenticated = true;
						});

						return true;
					} catch (error) {
						console.error("Token refresh failed:", error);

						// Clear auth state on refresh failure
						removeAuthToken();
						set((state) => {
							state.user = null;
							state.isAuthenticated = false;
							state.accessToken = null;
							state.refreshToken = null;
							state.error = "Session expired";
						});

						return false;
					}
				},

				setUser: (user: User) => {
					set((state) => {
						state.user = user;
					});
				},

				setTokens: (accessToken: string, refreshToken: string) => {
					setAuthToken(accessToken);
					setRefreshToken(refreshToken);

					set((state) => {
						state.accessToken = accessToken;
						state.refreshToken = refreshToken;
						state.isAuthenticated = true;
					});
				},

				clearAuth: () => {
					removeAuthToken();
					set((state) => {
						state.user = null;
						state.isAuthenticated = false;
						state.accessToken = null;
						state.refreshToken = null;
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
					accessToken: state.accessToken,
					refreshToken: state.refreshToken,
				}),
			},
		),
		{
			name: "lunarbase-auth-store",
			enabled: process.env.NODE_ENV === "development",
		},
	),
);

// Initialize auth state from stored tokens
export const initializeAuth = () => {
	const token = getAuthToken();
	const refreshToken = getRefreshToken();

	if (token && refreshToken) {
		// Check if token is still valid
		if (!isTokenExpiringSoon(token)) {
			// Token is still valid, set authenticated state
			return {
				isAuthenticated: true,
				accessToken: token,
				refreshToken: refreshToken,
				loading: false,
			};
		} else {
			// Token is expiring, will need to refresh
			return {
				isAuthenticated: false,
				accessToken: token,
				refreshToken: refreshToken,
				loading: true, // Will trigger refresh attempt
			};
		}
	}

	return {
		isAuthenticated: false,
		accessToken: null,
		refreshToken: null,
		loading: false,
	};
};
