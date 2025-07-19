import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import {
	authApi,
	getAuthToken,
	getRefreshToken,
	removeAuthToken,
} from "@/lib/api";

interface AuthContextType {
	isAuthenticated: boolean;
	isLoading: boolean;
	logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};

interface AuthProviderProps {
	children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
	const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const navigate = useNavigate();

	// Function to decode JWT and get expiration time
	const getTokenExpiration = (token: string): number | null => {
		try {
			const payload = JSON.parse(atob(token.split(".")[1]));
			return payload.exp * 1000; // Convert to milliseconds
		} catch {
			return null;
		}
	};

	// Function to check if token is about to expire (within 5 minutes)
	const isTokenExpiringSoon = (token: string): boolean => {
		const expiration = getTokenExpiration(token);
		if (!expiration) return true;

		const now = Date.now();
		const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
		return expiration - now < fiveMinutes;
	};

	// Function to refresh token
	const refreshToken = useCallback(async (): Promise<boolean> => {
		try {
			const refreshTokenValue = getRefreshToken();
			if (!refreshTokenValue) {
				return false;
			}

			await authApi.refresh();
			return true;
		} catch (error) {
			console.error("Token refresh failed:", error);
			return false;
		}
	}, []);

	// Function to logout
	const logout = useCallback(async () => {
		try {
			await authApi.logout();
		} catch (error) {
			console.error("Logout error:", error);
		} finally {
			removeAuthToken();
			setIsAuthenticated(false);
			navigate({ to: "/login" });
		}
	}, [navigate]);

	// Function to check authentication status
	const checkAuth = useCallback(async () => {
		const token = getAuthToken();

		if (!token) {
			setIsAuthenticated(false);
			setIsLoading(false);
			return;
		}

		// Check if token is expired or expiring soon
		if (isTokenExpiringSoon(token)) {
			const refreshSuccess = await refreshToken();
			if (!refreshSuccess) {
				setIsAuthenticated(false);
				setIsLoading(false);
				removeAuthToken();
				navigate({ to: "/login" });
				return;
			}
		}

		setIsAuthenticated(true);
		setIsLoading(false);
	}, [refreshToken, navigate]);

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
				const refreshSuccess = await refreshToken();
				if (!refreshSuccess) {
					await logout();
				}
			}
		}, 60000); // Check every minute

		return () => clearInterval(interval);
	}, [isAuthenticated, refreshToken, logout]);

	const value: AuthContextType = {
		isAuthenticated,
		isLoading,
		logout,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
