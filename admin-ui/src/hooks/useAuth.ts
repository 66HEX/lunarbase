import { useNavigate } from "@tanstack/react-router";
import { useCallback, useContext } from "react";
import { AuthContext } from "@/contexts/auth-context";
import { useAuthStore } from "@/stores/auth-persist.store";

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

	// Enhanced logout function that includes navigation
	const logout = useCallback(async () => {
		await storeLogout();
		navigate({ to: "/login" });
	}, [storeLogout, navigate]);

	// Function to check authentication status using store
	const checkAuth = useCallback(async () => {
		const isAuth = await storeCheckAuth();
		if (!isAuth) {
			navigate({ to: "/login" });
		}
		return isAuth;
	}, [storeCheckAuth, navigate]);

	// Use context if available (within AuthProvider), otherwise use store
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
