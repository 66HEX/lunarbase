import { Activity, Globe, Users, Wifi } from "lucide-react";
import { WebSocketStatsCard } from "@/components/websocket/WebSocketStatsCard";
import type { WebSocketStats as WebSocketStatsType } from "@/types/api";

interface WebSocketStatsProps {
	stats: WebSocketStatsType | undefined;
}

export function WebSocketStats({ stats }: WebSocketStatsProps) {

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			<WebSocketStatsCard
				title="Total Connections"
				value={stats?.total_connections || 0}
				icon={Globe}
				unit="connections"
				description="Number of active WebSocket connections"
			/>

			<WebSocketStatsCard
				title="Authenticated"
				value={stats?.authenticated_connections || 0}
				icon={Users}
				unit="users"
				description="Number of authenticated user connections"
			/>

			<WebSocketStatsCard
				title="Subscriptions"
				value={stats?.total_subscriptions || 0}
				icon={Activity}
				unit="active"
				description="Total number of active subscriptions"
			/>

			<WebSocketStatsCard
				title="Server Status"
				value={stats?.total_connections ? "Active" : "Idle"}
				icon={Wifi}
				description="Current WebSocket server status"
			/>
		</div>
	);
}