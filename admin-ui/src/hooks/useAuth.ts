import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { getAuthToken, getRefreshToken } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-persist.store";

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

export const useAuth = () => {
	const navigate = useNavigate();
	const {
		isAuthenticated,
		loading,
		error,
		user,
		logout: storeLogout,
		refreshTokens,
		setTokens,
		clearAuth,
	} = useAuthStore();

	// Enhanced logout function that includes navigation
	const logout = useCallback(async () => {
		await storeLogout();
		navigate({ to: "/login" });
	}, [storeLogout, navigate]);

	// Function to check authentication status and refresh tokens if needed
	const checkAuth = useCallback(async () => {
		const token = getAuthToken();
		const refreshToken = getRefreshToken();

		if (!token || !refreshToken) {
			clearAuth();
			return;
		}

		// If we have tokens but not authenticated in store, set them
		if (!isAuthenticated && token && refreshToken) {
			setTokens(token, refreshToken);
		}

		// Check if token is expired or expiring soon
		if (isTokenExpiringSoon(token)) {
			const refreshSuccess = await refreshTokens();
			if (!refreshSuccess) {
				clearAuth();
				navigate({ to: "/login" });
				return;
			}
		}
	}, [isAuthenticated, refreshTokens, setTokens, clearAuth, navigate]);

	// Initial authentication check
	useEffect(() => {
		checkAuth();
	}, [checkAuth]);

	// Set up automatic token refresh
	useEffect(() => {
		if (!isAuthenticated) return;

		const interval = setInterval(async () => {
			const token = getAuthToken();
			if (token && isTokenExpiringSoon(token)) {
				const refreshSuccess = await refreshTokens();
				if (!refreshSuccess) {
					await logout();
				}
			}
		}, 60000); // Check every minute

		return () => clearInterval(interval);
	}, [isAuthenticated, refreshTokens, logout]);

	return {
		isAuthenticated,
		isLoading: loading,
		error,
		user,
		logout,
		checkAuth,
	};
};

export default useAuth;
