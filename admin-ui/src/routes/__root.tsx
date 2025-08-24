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
import { useAuth } from "@/hooks/";
import { useAuthStore } from "@/stores/auth-persist.store";
import { useUI, useUIActions } from "@/stores/client.store";

export const Route = createRootRoute({
	component: RootComponent,
	beforeLoad: async ({ location }) => {
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
			{!isLoginPage && <Sidebar />}

			<div
				className={isLoginPage ? "" : "lg:pl-72 transition-all duration-300"}
			>
				<div className="min-h-screen flex flex-col">
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
								<h1 className="text-lg font-medium text-nocta-900 dark:text-nocta-100">
									LunarBase
								</h1>
								<div className="w-10" />{" "}
							</div>
						</header>
					)}

					<main
						className={
							isLoginPage
								? "flex-1"
								: "flex-1 p-4 bg-nocta-100 dark:bg-nocta-900"
						}
					>
						<div
							className={
								isLoginPage
									? "bg-nocta-950"
									: "bg-nocta-950 rounded-2xl p-4 h-[96svh] overflow-y-auto"
							}
						>
							<Outlet />
						</div>
					</main>
				</div>
			</div>
		</div>
	);
}
