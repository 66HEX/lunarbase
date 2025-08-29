import { createFileRoute } from "@tanstack/react-router";
import {
	ActivityIcon,
	WarningIcon,
	DatabaseIcon,
	FileTextIcon,
	GlobeIcon,
	UsersIcon,
} from "@phosphor-icons/react";
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

	const stats = {
		collections,
		websocket,
		health,
	};

	const quickActions = [
		{
			name: "Create Collection",
			action: "create-collection",
			icon: DatabaseIcon,
		},
		{
			name: "Create User",
			action: "create-user",
			icon: UsersIcon,
		},
		{
			name: "View Records",
			href: "/records",
			icon: FileTextIcon,
		},
		{
			name: "WebSocket Monitor",
			href: "/websocket",
			icon: ActivityIcon,
		},
	];

	const overviewCards = [
		{
			title: "Collections",
			value:
				stats.collections?.total_collections ||
				stats.health?.database?.total_collections ||
				0,
			icon: DatabaseIcon,
			description: "Total number of data collections in the system",
		},
		{
			title: "Total Records",
			value:
				stats.collections?.total_records ||
				stats.health?.database?.total_records ||
				0,
			icon: FileTextIcon,
			description: "Total number of records stored across all collections",
		},
		{
			title: "Active Connections",
			value: stats.websocket?.total_connections || 0,
			icon: GlobeIcon,
			description: "Current number of active WebSocket connections",
		},
		{
			title: "System Health",
			value: stats.health?.status === "healthy" ? "Healthy" : "Issues",
			icon: ActivityIcon,
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
			<DashboardHeader onRefresh={refetchAll} loading={isLoading} />

			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error.message || String(error)}</AlertDescription>
				</Alert>
			)}

			{stats.health && stats.health.status !== "healthy" && (
				<Alert variant="destructive">
					<WarningIcon size={16} />
					<AlertDescription>
						System health issues detected. Database status:{" "}
						{stats.health.database?.status || "Unknown"}
					</AlertDescription>
				</Alert>
			)}

			<div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
				<div className="xl:col-span-3 space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{overviewCards.map((card) => (
							<StatCard key={card.title} {...card} />
						))}
					</div>

					<CollectionsOverviewCard collections={stats.collections} />
				</div>

				<div className="lg:col-span-2 space-y-4">
					<QuickActionsCard actions={quickActions} />

					<HealthStatusCard health={stats.health} />
				</div>
			</div>
		</div>
	);
}

export const Route = createFileRoute("/dashboard")({
	component: DashboardComponent,
});
