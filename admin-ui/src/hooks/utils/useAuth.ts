import { useNavigate } from "@tanstack/react-router";
import { useCallback, useContext } from "react";
import { AuthContext } from "@/contexts/auth-context";
import { useAuthStore } from "@/stores/auth-persist.store";

/**
 * Hook for authentication management
 * Provides authentication state and methods for login/logout
 * @returns Authentication context or store data with enhanced methods
 */
export const useAuth = () => {
	const context = useContext(AuthContext);
	const navigate = useNavigate();
	const {
		isAuthenticated,
		loading,
		error,
		user,
		logout: storeLogout,
		checkAuth: storeCheckAuth,
		fetchUser,
	} = useAuthStore();

	const logout = useCallback(async () => {
		await storeLogout();
		navigate({ to: "/login" });
	}, [storeLogout, navigate]);

	const checkAuth = useCallback(async () => {
		const isAuth = await storeCheckAuth();
		if (!isAuth) {
			navigate({ to: "/login" });
		}
		return isAuth;
	}, [storeCheckAuth, navigate]);

	if (context) {
		return context;
	}

	return {
		isAuthenticated,
		isLoading: loading,
		error,
		user,
		logout,
		checkAuth,
		fetchUser,
	};
};

export default useAuth;
