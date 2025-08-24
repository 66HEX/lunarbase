import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { AuthContext, type AuthContextType } from "@/contexts/auth-context";
import { useAuthStore } from "@/stores/auth-persist.store";

interface AuthProviderProps {
	children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const navigate = useNavigate();
	const { isAuthenticated, checkAuth, logout: storeLogout } = useAuthStore();

	const logout = useCallback(async () => {
		try {
			await storeLogout();
			navigate({ to: "/login" });
		} catch {
			navigate({ to: "/login" });
		}
	}, [navigate, storeLogout]);

	const checkAuthStatus = useCallback(async () => {
		setIsLoading(true);
		try {
			const isAuth = await checkAuth();
			if (!isAuth) {
				navigate({ to: "/login" });
			}
		} catch {
			navigate({ to: "/login" });
		} finally {
			setIsLoading(false);
		}
	}, [checkAuth, navigate]);

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
