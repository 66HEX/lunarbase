import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TableColumn } from "@/components/ui/table";
import { Table } from "@/components/ui/table";
import type {
	WebSocketConnection,
	WebSocketConnectionsResponse,
} from "@/types/api";
import {
	connectionStatusColors,
	connectionStatusIcons,
	formatConnectionDate,
	formatConnectionId,
	getSubscriptionBadgeVariant,
	webSocketEmptyStates,
} from "./constants";

interface WebSocketConnectionsProps {
	connections: WebSocketConnectionsResponse | undefined;
	isLoading: boolean;
	onDisconnectConnection: (connectionId: string) => void;
}

export function WebSocketConnections({
	connections,
	isLoading,
	onDisconnectConnection,
}: WebSocketConnectionsProps) {
	const connectionColumns: TableColumn<WebSocketConnection>[] = [
		{
			key: "connection_id",
			title: "Connection ID",
			render: (_, connection) => (
				<div className="font-pp-neue-montreal-mono text-sm text-nocta-600 dark:text-nocta-400">
					{formatConnectionId(connection.connection_id)}
				</div>
			),
		},
		{
			key: "user_id",
			title: "User",
			render: (_, connection) => {
				const isAuthenticated = !!connection.user_id;
				const IconComponent = isAuthenticated
					? connectionStatusIcons.authenticated
					: connectionStatusIcons.anonymous;
				const colorClass = isAuthenticated
					? connectionStatusColors.authenticated
					: connectionStatusColors.anonymous;

				return (
					<div className="flex items-center gap-2">
						<IconComponent className={`w-4 h-4 ${colorClass}`} />
						<span className="text-sm font-light">
							{isAuthenticated ? `User ${connection.user_id}` : "Anonymous"}
						</span>
					</div>
				);
			},
		},
		{
			key: "connected_at",
			title: "Connected At",
			render: (_, connection) => {
				const { date, time } = formatConnectionDate(connection.connected_at);
				return (
					<div className="text-sm">
						<div className="text-nocta-900 dark:text-nocta-100">{date}</div>
						<div className="text-nocta-500 dark:text-nocta-500">{time}</div>
					</div>
				);
			},
		},
		{
			key: "subscriptions",
			title: "Subscriptions",
			render: (_, connection) => {
				const hasSubscriptions = connection.subscriptions.length > 0;
				return (
					<div className="flex flex-wrap gap-1">
						{hasSubscriptions ? (
							connection.subscriptions.map((sub) => (
								<Badge
									size="sm"
									key={sub.subscription_id}
									variant={getSubscriptionBadgeVariant(hasSubscriptions)}
									className="text-xs"
								>
									{sub.collection_name}
								</Badge>
							))
						) : (
							<span className="text-sm text-nocta-500">No subscriptions</span>
						)}
					</div>
				);
			},
		},
		{
			key: "actions",
			title: "Actions",
			align: "left",
			className: "w-32",
			render: (_, connection) => {
				const DisconnectIcon = connectionStatusIcons.disconnect;
				return (
					<Button
						variant="ghost"
						size="sm"
						className={connectionStatusColors.disconnect}
						onClick={() => onDisconnectConnection(connection.connection_id)}
					>
						<DisconnectIcon className="w-4 h-4 mr-1" />
						Disconnect
					</Button>
				);
			},
		},
	];

	return (
		<Card>
			<CardContent>
				{connections?.connections && connections.connections.length > 0 ? (
					<Table
						columns={
							connectionColumns as unknown as TableColumn<
								Record<string, unknown>
							>[]
						}
						data={
							connections.connections as unknown as Record<string, unknown>[]
						}
						loading={isLoading}
					/>
				) : (
					<div className="text-center py-8">
						<div className="p-3 rounded-xl bg-nocta-100 dark:bg-nocta-800 w-fit mx-auto mb-4 shadow-sm">
							<webSocketEmptyStates.connections.icon className="w-8 h-8 text-nocta-400 dark:text-nocta-500" />
						</div>
						<h3 className="text-lg font-light text-nocta-900 dark:text-nocta-100 mb-2">
							{webSocketEmptyStates.connections.title}
						</h3>
						<p className="text-nocta-600 dark:text-nocta-400">
							{webSocketEmptyStates.connections.description}
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
