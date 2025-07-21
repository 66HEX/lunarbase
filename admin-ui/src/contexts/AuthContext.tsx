import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { useAuthStore } from "@/stores/auth-persist.store";

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
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const navigate = useNavigate();
	const { isAuthenticated, checkAuth, logout: storeLogout } = useAuthStore();

	// Function to logout
	const logout = useCallback(async () => {
		try {
			await storeLogout();
			navigate({ to: "/login" });
		} catch (error) {
			navigate({ to: "/login" });
		}
	}, [navigate, storeLogout]);

	// Function to check authentication status
	const checkAuthStatus = useCallback(async () => {
		setIsLoading(true);
		try {
			const isAuth = await checkAuth();
			if (!isAuth) {
				navigate({ to: "/login" });
			}
		} catch (error) {
			navigate({ to: "/login" });
		} finally {
			setIsLoading(false);
		}
	}, [checkAuth, navigate]);

	// Initial authentication check
	useEffect(() => {
		checkAuthStatus();
	}, [checkAuthStatus]);

	const value: AuthContextType = {
		isAuthenticated,
		isLoading,
		logout,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
