import {
	Activity,
	Globe,
	UserCheck,
	Users,
	UserX,
	Wifi,
	WifiOff,
} from "lucide-react";

// WebSocket status icons
export const webSocketStatusIcons = {
	active: Wifi,
	idle: WifiOff,
	connected: Globe,
	authenticated: Users,
	subscriptions: Activity,
};

// User connection status icons
export const connectionStatusIcons = {
	authenticated: UserCheck,
	anonymous: UserX,
	disconnect: WifiOff,
};

// WebSocket status variants
export const getWebSocketStatusVariant = (status: string) => {
	const variants: {
		[key: string]:
			| "default"
			| "secondary"
			| "destructive"
			| "success"
			| "warning"
			| "outline";
	} = {
		active: "success",
		idle: "secondary",
		connected: "default",
		disconnected: "destructive",
	};
	return variants[status] || "secondary";
};

// Connection status colors
export const connectionStatusColors = {
	authenticated: "text-green-500",
	anonymous: "text-gray-400",
	disconnect:
		"text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20",
};

// WebSocket stats card configurations
export const webSocketStatsConfig = [
	{
		key: "total_connections",
		title: "Total Connections",
		icon: Globe,
		unit: "connections",
		description: "Number of active WebSocket connections",
	},
	{
		key: "authenticated_connections",
		title: "Authenticated",
		icon: Users,
		unit: "users",
		description: "Number of authenticated user connections",
	},
	{
		key: "total_subscriptions",
		title: "Subscriptions",
		icon: Activity,
		unit: "active",
		description: "Total number of active subscriptions",
	},
	{
		key: "server_status",
		title: "Server Status",
		icon: Wifi,
		description: "Current WebSocket server status",
		valueTransform: (stats: any) =>
			stats?.total_connections ? "Active" : "Idle",
	},
];

// Empty state messages
export const webSocketEmptyStates = {
	connections: {
		title: "No active connections",
		description: "WebSocket connections will appear here when clients connect",
		icon: Globe,
	},
	activity: {
		title: "No recent activity",
		description: "WebSocket activity will appear here when events occur",
		icon: Activity,
	},
	subscriptions: {
		title: "No active subscriptions",
		description: "Client subscriptions will appear here when established",
		icon: Activity,
	},
};

// Connection ID display format
export const formatConnectionId = (
	connectionId: string,
	length: number = 8,
) => {
	return `${connectionId.substring(0, length)}...`;
};

// Date formatting utilities
export const formatConnectionDate = (dateString: string) => {
	const date = new Date(dateString);
	return {
		date: date.toLocaleDateString(),
		time: date.toLocaleTimeString(),
	};
};

// Subscription badge variant
export const getSubscriptionBadgeVariant = (hasSubscriptions: boolean) => {
	return hasSubscriptions ? "secondary" : "outline";
};
