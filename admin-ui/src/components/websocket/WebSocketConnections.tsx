import { Globe, Users, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TableColumn } from "@/components/ui/table";
import { Table } from "@/components/ui/table";
import type { WebSocketConnection, WebSocketConnectionsResponse } from "@/types/api";

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
				<div className="font-mono text-sm text-nocta-600 dark:text-nocta-400">
					{connection.connection_id.substring(0, 8)}...
				</div>
			),
		},
		{
			key: "user_id",
			title: "User",
			render: (_, connection) => (
				<div className="flex items-center gap-2">
					{connection.user_id ? (
						<>
							<Users className="w-4 h-4 text-green-500" />
							<span className="text-sm font-medium">User {connection.user_id}</span>
						</>
					) : (
						<>
							<Users className="w-4 h-4 text-gray-400" />
							<span className="text-sm text-nocta-500">Anonymous</span>
						</>
					)}
				</div>
			),
		},
		{
			key: "connected_at",
			title: "Connected At",
			render: (_, connection) => (
				<div className="text-sm">
					<div className="text-nocta-900 dark:text-nocta-100">
						{new Date(connection.connected_at).toLocaleDateString()}
					</div>
					<div className="text-nocta-500 dark:text-nocta-500">
						{new Date(connection.connected_at).toLocaleTimeString()}
					</div>
				</div>
			),
		},
		{
			key: "subscriptions",
			title: "Subscriptions",
			render: (_, connection) => (
				<div className="flex flex-wrap gap-1">
					{connection.subscriptions.length > 0 ? (
						connection.subscriptions.map((sub) => (
							<Badge key={sub.subscription_id} variant="secondary" className="text-xs">
								{sub.collection_name}
							</Badge>
						))
					) : (
						<span className="text-sm text-nocta-500">No subscriptions</span>
					)}
				</div>
			),
		},
		{
			key: "actions",
			title: "Actions",
			align: "left",
			className: "w-32",
			render: (_, connection) => (
				<Button
					variant="ghost"
					size="sm"
					className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
					onClick={() => onDisconnectConnection(connection.connection_id)}
				>
					<WifiOff className="w-4 h-4 mr-1" />
					Disconnect
				</Button>
			),
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					Active Connections
					<Badge variant="secondary" className="ml-auto">
						{connections?.connections?.length || 0}
					</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent>
				{connections?.connections && connections.connections.length > 0 ? (
					<Table
						columns={connectionColumns as any}
						data={connections.connections as any}
						loading={isLoading}
					/>
				) : (
					<div className="text-center py-8">
						<div className="p-3 rounded-full bg-nocta-100 dark:bg-nocta-800/30 w-fit mx-auto mb-4">
							<Globe className="w-8 h-8 text-nocta-400 dark:text-nocta-500" />
						</div>
						<h3 className="text-lg font-semibold text-nocta-900 dark:text-nocta-100 mb-2">
							No active connections
						</h3>
						<p className="text-nocta-600 dark:text-nocta-400">
							WebSocket connections will appear here when clients connect
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}