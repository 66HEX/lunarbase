import {
	ActivityIcon,
	GlobeIcon,
	UserCheckIcon,
	UsersIcon,
	UserMinusIcon,
	WifiHighIcon,
	WifiSlashIcon,
} from "@phosphor-icons/react";

export const webSocketStatusIcons = {
	active: WifiHighIcon,
	idle: WifiSlashIcon,
	connected: GlobeIcon,
	authenticated: UsersIcon,
	subscriptions: ActivityIcon,
};

export const connectionStatusIcons = {
	authenticated: UserCheckIcon,
	anonymous: UserMinusIcon,
	disconnect: WifiSlashIcon,
};

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

export const connectionStatusColors = {
	authenticated: "text-green-500",
	anonymous: "text-gray-400",
	disconnect:
		"text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20",
};

export const webSocketStatsConfig = [
	{
		key: "total_connections",
		title: "Total Connections",
		icon: GlobeIcon,
		unit: "connections",
		description: "Number of active WebSocket connections",
	},
	{
		key: "authenticated_connections",
		title: "Authenticated",
		icon: UsersIcon,
		unit: "users",
		description: "Number of authenticated user connections",
	},
	{
		key: "total_subscriptions",
		title: "Subscriptions",
		icon: ActivityIcon,
		unit: "active",
		description: "Total number of active subscriptions",
	},
	{
		key: "server_status",
		title: "Server Status",
		icon: WifiHighIcon,
		description: "Current WebSocket server status",
		valueTransform: (stats: { total_connections?: number }) =>
			stats?.total_connections ? "Active" : "Idle",
	},
];

export const webSocketEmptyStates = {
	connections: {
		title: "No active connections",
		description: "WebSocket connections will appear here when clients connect",
		icon: GlobeIcon,
	},
	activity: {
		title: "No recent activity",
		description: "WebSocket activity will appear here when events occur",
		icon: ActivityIcon,
	},
	subscriptions: {
		title: "No active subscriptions",
		description: "Client subscriptions will appear here when established",
		icon: ActivityIcon,
	},
};

export const formatConnectionId = (
	connectionId: string,
	length: number = 8,
) => {
	return `${connectionId.substring(0, length)}...`;
};

export const formatConnectionDate = (dateString: string) => {
	const date = new Date(dateString);
	return {
		date: date.toLocaleDateString(),
		time: date.toLocaleTimeString(),
	};
};

export const getSubscriptionBadgeVariant = (hasSubscriptions: boolean) => {
	return hasSubscriptions ? "secondary" : "outline";
};
