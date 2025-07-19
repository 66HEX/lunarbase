import { createFileRoute } from "@tanstack/react-router";
import {
	Eye,
	MessageSquare,
	Pause,
	Play,
	RotateCcw,
	Wifi,
	WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomApiError } from "@/lib/api";
import type { WebSocketStats } from "@/types/api";

interface WebSocketConnection {
	id: string;
	userId?: number;
	userEmail?: string;
	ipAddress: string;
	userAgent: string;
	connectedAt: string;
	lastActivity: string;
	status: "connected" | "disconnected" | "idle";
	messagesSent: number;
	messagesReceived: number;
}

interface WebSocketMessage {
	id: string;
	connectionId: string;
	type: "subscribe" | "unsubscribe" | "data" | "error" | "ping" | "pong";
	payload: any;
	timestamp: string;
	direction: "inbound" | "outbound";
}

// Mock data for demonstration
const mockConnections: WebSocketConnection[] = [
	{
		id: "conn_1",
		userId: 1,
		userEmail: "admin@lunarbase.dev",
		ipAddress: "192.168.1.100",
		userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
		connectedAt: "2024-01-20T10:30:00Z",
		lastActivity: "2024-01-20T14:25:00Z",
		status: "connected",
		messagesSent: 45,
		messagesReceived: 32,
	},
	{
		id: "conn_2",
		userId: 2,
		userEmail: "editor@lunarbase.dev",
		ipAddress: "192.168.1.101",
		userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
		connectedAt: "2024-01-20T11:15:00Z",
		lastActivity: "2024-01-20T14:20:00Z",
		status: "connected",
		messagesSent: 23,
		messagesReceived: 18,
	},
	{
		id: "conn_3",
		ipAddress: "192.168.1.102",
		userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
		connectedAt: "2024-01-20T12:00:00Z",
		lastActivity: "2024-01-20T13:45:00Z",
		status: "idle",
		messagesSent: 8,
		messagesReceived: 12,
	},
];

const mockMessages: WebSocketMessage[] = [
	{
		id: "msg_1",
		connectionId: "conn_1",
		type: "subscribe",
		payload: { collection: "users", event: "created" },
		timestamp: "2024-01-20T14:25:00Z",
		direction: "inbound",
	},
	{
		id: "msg_2",
		connectionId: "conn_1",
		type: "data",
		payload: { event: "user.created", data: { id: 5, email: "new@user.com" } },
		timestamp: "2024-01-20T14:24:30Z",
		direction: "outbound",
	},
	{
		id: "msg_3",
		connectionId: "conn_2",
		type: "ping",
		payload: {},
		timestamp: "2024-01-20T14:20:00Z",
		direction: "inbound",
	},
	{
		id: "msg_4",
		connectionId: "conn_2",
		type: "pong",
		payload: {},
		timestamp: "2024-01-20T14:20:01Z",
		direction: "outbound",
	},
];

const mockStats: WebSocketStats = {
	total_connections: 3,
	active_connections: 2,
	messages_sent: 76,
	messages_received: 62,
	uptime_seconds: 86400,
};

const statusColors = {
	connected:
		"bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
	disconnected: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
	idle: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
};

const messageTypeColors = {
	subscribe: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
	unsubscribe:
		"bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
	data: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
	error: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
	ping: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
	pong: "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400",
};

export default function WebSocketComponent() {
	const [stats, setStats] = useState<WebSocketStats | null>(null);
	const [connections, setConnections] = useState<WebSocketConnection[]>([]);
	const [messages, setMessages] = useState<WebSocketMessage[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isMonitoring, setIsMonitoring] = useState(true);
	const [searchTerm] = useState("");
	const [selectedConnection, setSelectedConnection] = useState<string | null>(
		null,
	);

	const fetchData = useCallback(async () => {
		try {
			if (loading) {
				setError(null);
			}

			// In real app, these would be API calls
			// const [statsData, connectionsData, messagesData] = await Promise.all([
			//   webSocketApi.getStats(),
			//   webSocketApi.getConnections(),
			//   webSocketApi.getMessages()
			// ]);

			// For now, using mock data
			if (loading) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}

			setStats(mockStats);
			setConnections(mockConnections);
			setMessages(mockMessages);
		} catch (error) {
			setError(
				error instanceof CustomApiError
					? error.message
					: "Failed to fetch WebSocket data",
			);
		} finally {
			setLoading(false);
		}
	}, [loading]);

	useEffect(() => {
		fetchData();

		// Set up real-time updates
		const interval = setInterval(() => {
			if (isMonitoring) {
				fetchData();
			}
		}, 5000);

		return () => clearInterval(interval);
	}, [isMonitoring, fetchData]);

	const handleDisconnectConnection = async (connectionId: string) => {
		const connection = connections.find((c) => c.id === connectionId);
		if (!connection) return;

		if (
			!confirm(
				`Are you sure you want to disconnect connection ${connectionId}?`,
			)
		) {
			return;
		}

		try {
			// In real app: await webSocketApi.disconnectConnection(connectionId);
			setConnections((prev) =>
				prev.map((conn) =>
					conn.id === connectionId
						? { ...conn, status: "disconnected" as const }
						: conn,
				),
			);
		} catch (error) {
			setError(
				error instanceof CustomApiError
					? error.message
					: "Failed to disconnect connection",
			);
		}
	};

	const getConnectionUser = (connection: WebSocketConnection): string => {
		return connection.userEmail || `Anonymous (${connection.ipAddress})`;
	};

	const filteredConnections = connections.filter(
		(connection) =>
			getConnectionUser(connection)
				.toLowerCase()
				.includes(searchTerm.toLowerCase()) ||
			connection.ipAddress.includes(searchTerm) ||
			connection.id.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	const filteredMessages = selectedConnection
		? messages.filter((msg) => msg.connectionId === selectedConnection)
		: messages.filter(
				(msg) =>
					msg.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
					msg.connectionId.toLowerCase().includes(searchTerm.toLowerCase()),
			);

	if (loading) {
		return (
			<div className="flex items-center justify-center h-svh">
				<div className="text-center">
					<Spinner className="w-8 h-8 mx-auto mb-4" />
					<p className="text-nocta-600 dark:text-nocta-400">
						Loading WebSocket monitor...
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-4xl font-bold text-nocta-900 dark:text-nocta-100">
							WebSocket Monitor
						</h1>
						<Badge
							variant={stats?.active_connections ? "default" : "secondary"}
							className="px-2 py-0.5 text-xs font-medium"
						>
							{stats?.active_connections || 0} active
						</Badge>
					</div>
					<p className="text-lg text-nocta-600 dark:text-nocta-400">
						Real-time WebSocket connections and message monitoring
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						onClick={() => setIsMonitoring(!isMonitoring)}
						className={isMonitoring ? "text-green-600" : "text-gray-600"}
					>
						{isMonitoring ? (
							<>
								<Pause className="w-4 h-4 mr-2" />
								Pause
							</>
						) : (
							<>
								<Play className="w-4 h-4 mr-2" />
								Resume
							</>
						)}
					</Button>
					<Button variant="ghost" onClick={fetchData}>
						<RotateCcw className="w-4 h-4 mr-2" />
						Refresh
					</Button>
				</div>
			</div>

			{/* Error Alert */}
			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			<Tabs defaultValue="connections" className="space-y-6">
				<TabsList className="grid w-full max-w-md grid-cols-2">
					<TabsTrigger value="connections" className="flex items-center gap-2">
						Connections
					</TabsTrigger>
					<TabsTrigger value="messages" className="flex items-center gap-2">
						Messages
					</TabsTrigger>
				</TabsList>

				{/* Connections Tab */}
				<TabsContent value="connections" className="space-y-4">
					{filteredConnections.length > 0 ? (
						<div className="grid gap-4">
							{filteredConnections.map((connection) => (
								<Card key={connection.id}>
									<CardContent className="p-6">
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="flex items-center gap-3 mb-2">
													<h3 className="font-semibold text-nocta-900 dark:text-nocta-100">
														{getConnectionUser(connection)}
													</h3>
													<Badge className={statusColors[connection.status]}>
														{connection.status}
													</Badge>
													<Badge variant="outline" className="text-xs">
														{connection.id}
													</Badge>
												</div>

												<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
													<div>
														<p className="text-nocta-600 dark:text-nocta-400">
															IP Address
														</p>
														<p className="font-medium text-nocta-900 dark:text-nocta-100">
															{connection.ipAddress}
														</p>
													</div>
													<div>
														<p className="text-nocta-600 dark:text-nocta-400">
															Connected
														</p>
														<p className="font-medium text-nocta-900 dark:text-nocta-100">
															{new Date(
																connection.connectedAt,
															).toLocaleString()}
														</p>
													</div>
													<div>
														<p className="text-nocta-600 dark:text-nocta-400">
															Last Activity
														</p>
														<p className="font-medium text-nocta-900 dark:text-nocta-100">
															{new Date(
																connection.lastActivity,
															).toLocaleString()}
														</p>
													</div>
													<div>
														<p className="text-nocta-600 dark:text-nocta-400">
															Messages
														</p>
														<p className="font-medium text-nocta-900 dark:text-nocta-100">
															↑{connection.messagesSent} ↓
															{connection.messagesReceived}
														</p>
													</div>
												</div>

												<div className="mt-3">
													<p className="text-nocta-600 dark:text-nocta-400 text-xs mb-1">
														User Agent
													</p>
													<p className="text-xs text-nocta-500 dark:text-nocta-500 truncate">
														{connection.userAgent}
													</p>
												</div>
											</div>

											<div className="ml-4 flex items-center gap-2">
												<Button
													variant="ghost"
													size="sm"
													className="w-8 h-8 p-0"
													onClick={() => setSelectedConnection(connection.id)}
													title="View messages"
												>
													<Eye className="w-4 h-4" />
												</Button>
												{connection.status === "connected" && (
													<Button
														variant="ghost"
														size="sm"
														className="w-8 h-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
														onClick={() =>
															handleDisconnectConnection(connection.id)
														}
														title="Disconnect"
													>
														<WifiOff className="w-4 h-4" />
													</Button>
												)}
											</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					) : (
						<Card>
							<CardContent className="py-12">
								<div className="text-center">
									<div className="p-3 rounded-full bg-nocta-100 dark:bg-nocta-800/30 w-fit mx-auto mb-4">
										<Wifi className="w-8 h-8 text-nocta-400 dark:text-nocta-500" />
									</div>
									<h3 className="text-lg font-semibold text-nocta-900 dark:text-nocta-100 mb-2">
										{searchTerm
											? "No connections found"
											: "No active connections"}
									</h3>
									<p className="text-nocta-600 dark:text-nocta-400 max-w-sm mx-auto">
										{searchTerm
											? `No connections match "${searchTerm}". Try a different search term.`
											: "No WebSocket connections are currently active."}
									</p>
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>

				{/* Messages Tab */}
				<TabsContent value="messages" className="space-y-4">
					{selectedConnection && (
						<Alert>
							<AlertDescription className="flex items-center justify-between">
								<span>
									Showing messages for connection: {selectedConnection}
								</span>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setSelectedConnection(null)}
								>
									Show all messages
								</Button>
							</AlertDescription>
						</Alert>
					)}

					{filteredMessages.length > 0 ? (
						<div className="space-y-2">
							{filteredMessages.map((message) => (
								<Card key={message.id}>
									<CardContent className="p-4">
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<div className="flex items-center gap-3 mb-2">
													<Badge className={messageTypeColors[message.type]}>
														{message.type}
													</Badge>
													<Badge
														variant={
															message.direction === "inbound"
																? "default"
																: "secondary"
														}
													>
														{message.direction === "inbound" ? "→ IN" : "← OUT"}
													</Badge>
													<span className="text-sm text-nocta-600 dark:text-nocta-400">
														{message.connectionId}
													</span>
													<span className="text-xs text-nocta-500 dark:text-nocta-500">
														{new Date(message.timestamp).toLocaleTimeString()}
													</span>
												</div>

												<div className="bg-nocta-50 dark:bg-nocta-800/30 rounded-lg p-3">
													<pre className="text-xs text-nocta-700 dark:text-nocta-300 overflow-x-auto">
														{JSON.stringify(message.payload, null, 2)}
													</pre>
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
							))}
						</div>
					) : (
						<Card>
							<CardContent className="py-12">
								<div className="text-center">
									<div className="p-3 rounded-full bg-nocta-100 dark:bg-nocta-800/30 w-fit mx-auto mb-4">
										<MessageSquare className="w-8 h-8 text-nocta-400 dark:text-nocta-500" />
									</div>
									<h3 className="text-lg font-semibold text-nocta-900 dark:text-nocta-100 mb-2">
										{searchTerm || selectedConnection
											? "No messages found"
											: "No messages yet"}
									</h3>
									<p className="text-nocta-600 dark:text-nocta-400 max-w-sm mx-auto">
										{searchTerm || selectedConnection
											? "No messages match your current filter."
											: "WebSocket messages will appear here when connections are active."}
									</p>
								</div>
							</CardContent>
						</Card>
					)}
				</TabsContent>
			</Tabs>
		</div>
	);
}

export const Route = createFileRoute("/websocket")({
	component: WebSocketComponent,
});
