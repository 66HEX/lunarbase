// Auth Store Slice
import type { StateCreator } from "zustand";
import {
	authApi,
	getAuthToken,
	getRefreshToken,
	removeAuthToken,
	setAuthToken,
	setRefreshToken,
} from "@/lib/api";
import type { User } from "@/types/api";
import type { AuthStore, RootStore } from "@/types/store.types";

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

export const createAuthSlice: StateCreator<
	RootStore,
	[
		["zustand/devtools", never],
		["zustand/subscribeWithSelector", never],
		["zustand/immer", never],
	],
	[],
	AuthStore
> = (set) => ({
	// Initial state
	user: null,
	isAuthenticated: false,
	accessToken: null,
	refreshToken: null,
	loading: true,
	error: null,

	// Actions
	login: async (email: string, password: string) => {
		set((state) => {
			state.auth.loading = true;
			state.auth.error = null;
		});

		try {
			const response = await authApi.login({ email, password });
			const { user, access_token, refresh_token } = response.data;

			// Store tokens
			setAuthToken(access_token);
			setRefreshToken(refresh_token);

			set((state) => {
				state.auth.user = user;
				state.auth.isAuthenticated = true;
				state.auth.accessToken = access_token;
				state.auth.refreshToken = refresh_token;
				state.auth.loading = false;
				state.auth.error = null;
			});
		} catch (error: any) {
			set((state) => {
				state.auth.loading = false;
				state.auth.error = error.message || "Login failed";
				state.auth.isAuthenticated = false;
				state.auth.user = null;
				state.auth.accessToken = null;
				state.auth.refreshToken = null;
			});
			throw error;
		}
	},

	logout: async () => {
		set((state) => {
			state.auth.loading = true;
		});

		try {
			await authApi.logout();
		} catch (error) {
			console.error("Logout error:", error);
		} finally {
			// Always clear auth state regardless of API call result
			removeAuthToken();
			set((state) => {
				state.auth.user = null;
				state.auth.isAuthenticated = false;
				state.auth.accessToken = null;
				state.auth.refreshToken = null;
				state.auth.loading = false;
				state.auth.error = null;
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
				state.auth.accessToken = access_token;
				state.auth.refreshToken = refresh_token;
				state.auth.user = user;
				state.auth.isAuthenticated = true;
			});

			return true;
		} catch (error) {
			console.error("Token refresh failed:", error);

			// Clear auth state on refresh failure
			removeAuthToken();
			set((state) => {
				state.auth.user = null;
				state.auth.isAuthenticated = false;
				state.auth.accessToken = null;
				state.auth.refreshToken = null;
				state.auth.error = "Session expired";
			});

			return false;
		}
	},

	setUser: (user: User) => {
		set((state) => {
			state.auth.user = user;
		});
	},

	setTokens: (accessToken: string, refreshToken: string) => {
		setAuthToken(accessToken);
		setRefreshToken(refreshToken);

		set((state) => {
			state.auth.accessToken = accessToken;
			state.auth.refreshToken = refreshToken;
			state.auth.isAuthenticated = true;
		});
	},

	clearAuth: () => {
		removeAuthToken();
		set((state) => {
			state.auth.user = null;
			state.auth.isAuthenticated = false;
			state.auth.accessToken = null;
			state.auth.refreshToken = null;
			state.auth.loading = false;
			state.auth.error = null;
		});
	},
});

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
