import { Link, useLocation } from "@tanstack/react-router";
import {
	Activity,
	BarChart3,
	Database,
	FileText,
	LayoutDashboard,
	LogOut,
	Settings,
	Users,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import LunarLogo from "@/assets/lunar.svg";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useUI, useUIActions } from "@/stores/client.store";

const navigation = [
	{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
	{ name: "Collections", href: "/collections", icon: Database },
	{ name: "Records", href: "/records", icon: FileText },
	{ name: "Users", href: "/users", icon: Users },
	{ name: "WebSocket", href: "/websocket", icon: Activity },
	{ name: "Metrics", href: "/metrics", icon: BarChart3 },
	{ name: "Settings", href: "/settings", icon: Settings },
];

const getProxyUrl = (originalUrl: string): string => {
	// Check if it's an external URL that needs proxying
	if (
		originalUrl.startsWith("https://lh3.googleusercontent.com") ||
		originalUrl.startsWith("https://avatars.githubusercontent.com")
	) {
		const proxyUrl = `/api/avatar-proxy?url=${encodeURIComponent(originalUrl)}`;
		return proxyUrl;
	}
	return originalUrl;
};

export function Sidebar() {
	const location = useLocation();
	const authData = useAuth();
	const logout = authData.logout;
	const user = "user" in authData ? authData.user : null;
	const { sidebar } = useUI();
	const { setSidebarOpen } = useUIActions();
	const sidebarRef = useRef<HTMLDivElement>(null);
	const [isVisible, setIsVisible] = useState(false);
	const [shouldRender, setShouldRender] = useState(false);
	const timeoutRef = useRef<number | null>(null);

	// Memoize setSidebarOpen to prevent infinite loops
	const setSidebarOpenStable = useCallback(
		(isOpen: boolean) => {
			setSidebarOpen(isOpen);
		},
		[setSidebarOpen],
	);

	const handleLogout = async () => {
		await logout();
	};

	// Close sidebar on mobile when clicking outside or on route change
	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth >= 1024) {
				// Desktop: always show sidebar
				setSidebarOpenStable(true);
			} else {
				// Mobile/tablet: hide sidebar by default
				setSidebarOpenStable(false);
			}
		};

		// Set initial state
		handleResize();

		// Listen for resize events
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [setSidebarOpenStable]);

	// Close sidebar on route change (mobile only)
	useEffect(() => {
		if (window.innerWidth < 1024) {
			setSidebarOpenStable(false);
		}
	}, [location.pathname, setSidebarOpenStable]);

	// Handle animation states
	useEffect(() => {
		if (timeoutRef.current) {
			window.clearTimeout(timeoutRef.current);
		}

		if (sidebar.isOpen && window.innerWidth < 1024) {
			setShouldRender(true);
			timeoutRef.current = window.setTimeout(() => {
				setIsVisible(true);
			}, 16);
		} else {
			setIsVisible(false);
			if (window.innerWidth < 1024) {
				timeoutRef.current = window.setTimeout(() => {
					setShouldRender(false);
				}, 300);
			} else {
				setShouldRender(true);
				setIsVisible(true);
			}
		}

		return () => {
			if (timeoutRef.current) {
				window.clearTimeout(timeoutRef.current);
			}
		};
	}, [sidebar.isOpen]);

	// Handle click outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (
				sidebarRef.current &&
				!sidebarRef.current.contains(e.target as Node) &&
				window.innerWidth < 1024
			) {
				setSidebarOpen(false);
			}
		};

		if (sidebar.isOpen && window.innerWidth < 1024) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [sidebar.isOpen, setSidebarOpen]);

	return (
		<>
			{/* Backdrop for mobile */}
			{shouldRender && window.innerWidth < 1024 && (
				<div
					className={cn(
						"fixed inset-0 bg-black/50 z-30 lg:hidden transition-opacity duration-300 ease-out",
						isVisible ? "opacity-100" : "opacity-0",
					)}
					onClick={() => setSidebarOpen(false)}
					aria-hidden="true"
				/>
			)}

			{/* Sidebar */}
			<div
				ref={sidebarRef}
				className={cn(
					"fixed inset-y-0 left-0 overflow-hidden z-40 w-72 bg-white/80 dark:bg-nocta-900/80 p-[1px] bg-linear-to-b from-nocta-200 dark:from-nocta-600/50 to-transparent transition-transform duration-300 ease-in-out",
					sidebar.isOpen ? "translate-x-0" : "-translate-x-full",
					"lg:translate-x-0",
				)}
			>
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
						{/* Close button for mobile */}
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setSidebarOpen(false)}
							className="lg:hidden p-2 text-nocta-600 dark:text-nocta-400 hover:bg-nocta-100 dark:hover:bg-nocta-800/50"
						>
							<X className="w-5 h-5" />
						</Button>
					</div>

					{/* Navigation */}
					<nav className="flex-1 px-4 py-6 space-y-1">
						{navigation.map((item) => {
							const Icon = item.icon;
							const currentPath =
								location.pathname.replace(/^\/admin/, "") || "/";
							const isActive =
								currentPath === item.href ||
								(item.href !== "/" && currentPath.startsWith(item.href));

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
										className={`w-5 h-5 transition-colors ${
											isActive
												? "text-nocta-900"
												: "text-nocta-400 dark:text-nocta-500 group-hover:text-nocta-600 dark:group-hover:text-nocta-300"
										}`}
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
								src={
									user?.avatar_url ? getProxyUrl(user.avatar_url) : undefined
								}
								fallback={
									user?.username
										? user.username.substring(0, 2).toUpperCase()
										: "U"
								}
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
		</>
	);
}
