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
import { useAuth, usePrefetch } from "@/hooks/";
import { cn } from "@/lib/utils";
import { useUI, useUIActions } from "@/stores/client.store";

const navigation = [
	{
		name: "Dashboard",
		href: "/dashboard",
		icon: LayoutDashboard,
		adminOnly: true,
	},
	{
		name: "Collections",
		href: "/collections",
		icon: Database,
		adminOnly: false,
	},
	{ name: "Records", href: "/records", icon: FileText, adminOnly: false },
	{ name: "Users", href: "/users", icon: Users, adminOnly: true },
	{ name: "WebSocket", href: "/websocket", icon: Activity, adminOnly: true },
	{ name: "Metrics", href: "/metrics", icon: BarChart3, adminOnly: true },
	{ name: "Settings", href: "/settings", icon: Settings, adminOnly: true },
];

const getProxyUrl = (originalUrl: string): string => {
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

	const {
		prefetchUsers,
		prefetchCollections,
		prefetchRecords,
		prefetchWebSocket,
		prefetchMetrics,
		prefetchSettings,
		prefetchDashboard,
	} = usePrefetch();

	const setSidebarOpenStable = useCallback(
		(isOpen: boolean) => {
			setSidebarOpen(isOpen);
		},
		[setSidebarOpen],
	);

	const handleLogout = async () => {
		await logout();
	};

	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth >= 1024) {
				setSidebarOpenStable(true);
			} else {
				setSidebarOpenStable(false);
			}
		};

		handleResize();

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [setSidebarOpenStable]);

	useEffect(() => {
		if (window.innerWidth < 1024) {
			setSidebarOpenStable(false);
		}
	}, [location.pathname, setSidebarOpenStable]);

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

			<div
				ref={sidebarRef}
				className={cn(
					"fixed inset-y-0 left-0 overflow-hidden z-40 w-72 transition-transform duration-300 ease-in-out",
					sidebar.isOpen ? "translate-x-0" : "-translate-x-full",
					"lg:translate-x-0",
				)}
			>
				<div className="flex flex-col h-full bg-nocta-100 dark:bg-nocta-900 shadow-sm dark:shadow-lg">
					<div className="flex items-center justify-between p-4">
						<div className="flex items-center space-x-3">
							<div className="w-9 h-9 bg-nocta-800 rounded-lg flex items-center justify-center shadow-lg border border-nocta-50/5">
								<LunarLogo className="h-6 w-6 text-white" />
							</div>
							<div>
								<h1 className="text-lg font-light text-nocta-900 dark:text-nocta-100">
									LunarBase
								</h1>
							</div>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setSidebarOpen(false)}
							className="lg:hidden p-2 text-nocta-600 dark:text-nocta-400 hover:bg-nocta-100 dark:hover:bg-nocta-800/40"
						>
							<X className="w-5 h-5" />
						</Button>
					</div>

					<nav className="flex-1 px-4 py-3 space-y-1.5 relative">
						<div
							className="absolute left-4 w-[calc(100%-2rem)] h-[42px] rounded-lg bg-linear-to-b from-nocta-900 to-nocta-700 dark:from-nocta-700 dark:to-nocta-700/50 hover:contrast-125 text-nocta-900 dark:text-nocta-100 focus-visible:ring-nocta-900/50 dark:focus-visible:ring-nocta-100/50 transition-all duration-300 ease-in-out opacity-100 z-0 shadow-md"
							style={{
								transform: `translateY(${
									navigation
										.filter((item) => !item.adminOnly || user?.role === "admin")
										.findIndex((item) => {
											const currentPath =
												location.pathname.replace(/^\/admin/, "") || "/";
											return (
												currentPath === item.href ||
												(item.href !== "/" && currentPath.startsWith(item.href))
											);
										}) * 46
								}px)`,
							}}
						>
							<span
								aria-hidden
								className="pointer-events-none absolute -inset-px rounded-lg bg-gradient-to-b to-transparent opacity-60"
								style={{
									maskImage:
										"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
									WebkitMaskImage:
										"radial-gradient(120% 100% at 50% 0%, black 30%, transparent 70%)",
								}}
							/>

							<span
								aria-hidden
								className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-lg opacity-60"
								style={{
									background:
										"linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
								}}
							/>
						</div>
						{navigation
							.filter((item) => !item.adminOnly || user?.role === "admin")
							.map((item) => {
								const Icon = item.icon;
								const currentPath =
									location.pathname.replace(/^\/admin/, "") || "/";
								const isActive =
									currentPath === item.href ||
									(item.href !== "/" && currentPath.startsWith(item.href));

								const handleMouseEnter = () => {
									switch (item.href) {
										case "/dashboard":
											prefetchDashboard();
											break;
										case "/users":
											prefetchUsers();
											break;
										case "/collections":
											prefetchCollections();
											break;
										case "/records":
											prefetchRecords();
											break;
										case "/websocket":
											prefetchWebSocket();
											break;
										case "/metrics":
											prefetchMetrics();
											break;
										case "/settings":
											prefetchSettings();
											break;
									}
								};

								return (
									<Link
										key={item.name}
										to={item.href}
										onMouseEnter={handleMouseEnter}
										className={`group relative flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-light duration-300 ease-in-out transition-all z-10 ${
											isActive
												? "text-white dark:text-white hover:contrast-125"
												: "text-nocta-700 dark:text-nocta-400 hover:bg-nocta-100 dark:hover:bg-nocta-800/40 hover:text-nocta-900 dark:hover:text-nocta-100"
										}`}
									>
										<Icon
											className={`w-5 h-5 transition-all ${
												isActive
													? "text-nocta-900 dark:text-nocta-100"
													: "text-nocta-400 dark:text-nocta-500 group-hover:text-nocta-600 dark:group-hover:text-nocta-300"
											}`}
										/>
										<span>{item.name}</span>
									</Link>
								);
							})}
					</nav>

					<div className="p-4">
						<div className="flex items-center space-x-3 mb-3 p-3 bg-nocta-50 dark:bg-nocta-800/30 rounded-lg border border-nocta-200 dark:border-nocta-800">
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
								<p className="text-sm font-light text-nocta-900 dark:text-nocta-100 truncate">
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
							className="w-full justify-start text-nocta-600 dark:text-nocta-400 hover:bg-nocta-100 dark:hover:bg-nocta-800/40 hover:text-nocta-900 dark:hover:text-nocta-100"
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
