import { createFileRoute } from "@tanstack/react-router";
import {
	Activity,
	AlertTriangle,
	Database,
	FileText,
	Globe,
	Users,
} from "lucide-react";
import { useRef } from "react";
import {
	CollectionsOverviewCard,
	DashboardHeader,
	HealthStatusCard,
	QuickActionsCard,
	StatCard,
} from "@/components/dashboard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useDashboardStats } from "@/hooks";

function DashboardComponent() {
	const { collections, websocket, health, isLoading, error, refetchAll } =
		useDashboardStats();
	const pageRef = useRef<HTMLDivElement>(null);

	// Create stats object for backward compatibility with existing components
	const stats = {
		collections,
		websocket,
		health,
	};

	const quickActions = [
		{
			name: "Create Collection",
			href: "/collections",
			icon: Database,
			color: "bg-blue-500",
		},
		{
			name: "View Users",
			href: "/users",
			icon: Users,
			color: "bg-green-500",
		},
		{
			name: "View Records",
			href: "/records",
			icon: FileText,
			color: "bg-purple-500",
		},
		{
			name: "WebSocket Monitor",
			href: "/websocket",
			icon: Activity,
			color: "bg-orange-500",
		},
	];

	const overviewCards = [
		{
			title: "Collections",
			value:
				stats.collections?.total_collections ||
				stats.health?.database?.total_collections ||
				0,
			icon: Database,
			description: "Total number of data collections in the system",
		},
		{
			title: "Total Records",
			value:
				stats.collections?.total_records ||
				stats.health?.database?.total_records ||
				0,
			icon: FileText,
			description: "Total number of records stored across all collections",
		},
		{
			title: "Active Connections",
			value: stats.websocket?.total_connections || 0,
			icon: Globe,
			description: "Current number of active WebSocket connections",
		},
		{
			title: "System Health",
			value: stats.health?.status === "healthy" ? "Healthy" : "Issues",
			icon: Activity,
			description: "Current overall system health status",
		},
	];

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-svh">
				<div className="text-center">
					<Spinner className="w-8 h-8 mx-auto mb-4" />
					<p className="text-nocta-600 dark:text-nocta-400">
						Loading dashboard...
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4" ref={pageRef}>
			{/* Header */}
			<DashboardHeader onRefresh={refetchAll} loading={isLoading} />

			{/* Error Alert */}
			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error.message || String(error)}</AlertDescription>
				</Alert>
			)}

			{/* Health Alert */}
			{stats.health && stats.health.status !== "healthy" && (
				<Alert variant="destructive">
					<AlertTriangle className="h-4 w-4" />
					<AlertDescription>
						System health issues detected. Database status:{" "}
						{stats.health.database?.status || "Unknown"}
					</AlertDescription>
				</Alert>
			)}

			<div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
				{/* Main Content */}
				<div className="xl:col-span-3 space-y-4">
					{/* Overview Cards */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{overviewCards.map((card) => (
							<StatCard key={card.title} {...card} />
						))}
					</div>

					{/* Collections Overview */}
					<CollectionsOverviewCard collections={stats.collections} />
				</div>

				{/* Right Column */}
				<div className="lg:col-span-2 space-y-4">
					{/* Quick Actions Card */}
					<QuickActionsCard actions={quickActions} />

					{/* System Health Card */}
					<HealthStatusCard health={stats.health} />
				</div>
			</div>
		</div>
	);
}

export const Route = createFileRoute("/dashboard")({
	component: DashboardComponent,
});
