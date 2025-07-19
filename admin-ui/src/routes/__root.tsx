import {
	createRootRoute,
	Link,
	Outlet,
	redirect,
	useLocation,
} from "@tanstack/react-router";
import { useEffect } from "react";
import {
	Activity,
	BarChart3,
	Database,
	FileText,
	LayoutDashboard,
	LogOut,
	Settings,
	Shield,
	Users,
} from "lucide-react";
import LunarLogo from "@/assets/lunar.svg";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getAuthToken } from "@/lib/api";

const navigation = [
	{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
	{ name: "Collections", href: "/collections", icon: Database },
	{ name: "Users", href: "/users", icon: Users },
	{ name: "Records", href: "/records", icon: FileText },
	{ name: "Permissions", href: "/permissions", icon: Shield },
	{ name: "WebSocket", href: "/websocket", icon: Activity },
	{ name: "Metrics", href: "/metrics", icon: BarChart3 },
	{ name: "Settings", href: "/settings", icon: Settings },
];

export const Route = createRootRoute({
	component: RootComponent,
	beforeLoad: ({ location }) => {
		// Allow access to login page without authentication
		if (
			location.pathname === "/login" ||
			location.pathname.endsWith("/login")
		) {
			return;
		}

		// Check if user is authenticated
		const token = getAuthToken();
		if (!token) {
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
	const { logout, user, isAuthenticated, fetchUser } = useAuth();

	// Fetch user data if authenticated but user data is not loaded
	useEffect(() => {
		if (isAuthenticated && !user) {
			fetchUser();
		}
	}, [isAuthenticated, user, fetchUser]);

	const handleLogout = async () => {
		await logout();
	};

	const isLoginPage =
		location.pathname === "/login" || location.pathname.endsWith("/login");

	return (
		<div className="min-h-screen">
			{/* Sidebar - hidden on login page */}
			{!isLoginPage && (
				<div className="fixed inset-y-0 left-0 overflow-hidden z-40 w-72 bg-white/80 dark:bg-nocta-900/80 p-[1px] bg-linear-to-b from-nocta-200 dark:from-nocta-600/50 to-transparent">
					<div className="flex flex-col h-full bg-nocta-100 dark:bg-nocta-900 shadow-sm dark:shadow-lg">
						{/* Header */}
						<div className="flex items-center justify-between p-4 border-b border-nocta-200 dark:border-nocta-800">
							<div className="flex items-center space-x-3">
								<div className="w-9 h-9 bg-gradient-to-br from-nocta-800 to-nocta-600 rounded-lg flex items-center justify-center shadow-md">
									<LunarLogo className="h-6 w-6 text-white" />
								</div>
								<div>
									<h1 className="text-lg font-semibold text-nocta-900 dark:text-nocta-100">
										LunarBase
									</h1>
								</div>
							</div>
						</div>

						{/* Navigation */}
						<nav className="flex-1 px-4 py-6 space-y-1">
							{navigation.map((item) => {
								const Icon = item.icon;
								const isActive =
									location.pathname === `/admin${item.href}` ||
									location.pathname.startsWith(`/admin${item.href}`);

								return (
									<Link
										key={item.name}
										to={item.href}
										className={`group flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
											isActive
												? "bg-linear-to-b from-nocta-900 to-nocta-700 dark:from-nocta-200 dark:to-nocta-400 hover:contrast-125 text-white dark:text-nocta-900"
												: "text-nocta-600 dark:text-nocta-400 hover:bg-nocta-100 dark:hover:bg-nocta-800/50 hover:text-nocta-900 dark:hover:text-nocta-100"
										}`}
									>
										<Icon
											className={`w-5 h-5 transition-colors ${isActive ? "text-nocta-900" : "text-nocta-400 dark:text-nocta-500 group-hover:text-nocta-600 dark:group-hover:text-nocta-300"}`}
										/>
										<span>{item.name}</span>
									</Link>
								);
							})}
						</nav>

						{/* User Profile */}
							<div className="p-4 border-t border-nocta-200 dark:border-nocta-800">
								<div className="flex items-center space-x-3 mb-3">
									<Avatar 
										size="md" 
										fallback={user?.username ? user.username.substring(0, 2).toUpperCase() : "U"} 
										status="online" 
									/>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium text-nocta-900 dark:text-nocta-100 truncate">
											{user?.username || "Loading..."}
										</p>
										<p className="text-xs text-nocta-600 dark:text-nocta-400 truncate">
											{user?.email || "Loading..."}
										</p>
									</div>
								</div>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleLogout}
								className="w-full justify-start text-nocta-600 dark:text-nocta-400 hover:bg-nocta-100 dark:hover:bg-nocta-800/50"
							>
								<LogOut className="w-4 h-4 mr-2" />
								Logout
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Main content */}
			<div className={isLoginPage ? "" : "pl-72"}>
				<div className="min-h-screen flex flex-col">
					{/* Page content */}
					<main className="flex-1 p-4">
						<Outlet />
					</main>
				</div>
			</div>
		</div>
	);
}
