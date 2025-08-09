import {
	createRootRoute,
	Outlet,
	redirect,
	useLocation,
} from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/stores/auth-persist.store";
import { useUI, useUIActions } from "@/stores/client.store";

export const Route = createRootRoute({
	component: RootComponent,
	beforeLoad: async ({ location }) => {
		// Allow access to login, register and auth pages without authentication
		// Check both /login and /admin/login due to basepath configuration
		if (
			location.pathname === "/login" ||
			location.pathname === "/register" ||
			location.pathname === "/forgot-password" ||
			location.pathname === "/reset-password" ||
			location.pathname === "/admin/login" ||
			location.pathname === "/admin/register" ||
			location.pathname === "/admin/forgot-password" ||
			location.pathname === "/admin/reset-password" ||
			location.pathname === "/admin/auth/success" ||
			location.pathname === "/admin/auth/error"
		) {
			return;
		}

		// Check if user is authenticated using auth store
		const { checkAuth } = useAuthStore.getState();
		const isAuthenticated = await checkAuth();
		if (!isAuthenticated) {
			throw redirect({
				to: "/login",
				search: {
					redirect: location.pathname,
				},
			});
		}
	},
});

function RootComponent() {
	const location = useLocation();
	const authData = useAuth();
	const user = "user" in authData ? authData.user : null;
	const isAuthenticated = authData.isAuthenticated;
	const fetchUser = "fetchUser" in authData ? authData.fetchUser : undefined;
	const { sidebar } = useUI();
	const { setSidebarOpen } = useUIActions();

	// Fetch user data if authenticated but user data is not loaded
	useEffect(() => {
		if (isAuthenticated && !user && fetchUser) {
			fetchUser();
		}
	}, [isAuthenticated, user, fetchUser]);

	const isLoginPage =
		location.pathname === "/login" ||
		location.pathname === "/register" ||
		location.pathname === "/forgot-password" ||
		location.pathname === "/reset-password" ||
		location.pathname === "/admin/login" ||
		location.pathname === "/admin/register" ||
		location.pathname === "/admin/forgot-password" ||
		location.pathname === "/admin/reset-password" ||
		location.pathname === "/admin/auth/success" ||
		location.pathname === "/admin/auth/error";

	return (
		<div className="min-h-screen">
			{/* Sidebar - hidden on login page */}
			{!isLoginPage && <Sidebar />}

			{/* Main content */}
			<div
				className={isLoginPage ? "" : "lg:pl-72 transition-all duration-300"}
			>
				<div className="min-h-screen flex flex-col">
					{/* Mobile header with hamburger menu */}
					{!isLoginPage && (
						<header className="lg:hidden bg-white dark:bg-nocta-900 border-b border-nocta-200 dark:border-nocta-800 p-2">
							<div className="flex items-center justify-between">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setSidebarOpen(!sidebar.isOpen)}
									className="p-2 text-nocta-600 dark:text-nocta-400 hover:bg-nocta-100 dark:hover:bg-nocta-800/50"
								>
									<Menu className="w-6 h-6" />
								</Button>
								<h1 className="text-lg font-semibold text-nocta-900 dark:text-nocta-100">
									LunarBase
								</h1>
								<div className="w-10" /> {/* Spacer for centering */}
							</div>
						</header>
					)}

					{/* Page content */}
					<main className={isLoginPage ? "flex-1" : "flex-1 p-4"}>
						<Outlet />
					</main>
				</div>
			</div>
		</div>
	);
}
