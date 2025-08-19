import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { webSocketApi } from "@/lib/api";
import type {
	BroadcastMessageRequest,
	BroadcastMessageResponse,
	WebSocketActivityResponse,
	WebSocketConnectionsResponse,
	WebSocketStats,
} from "@/types/api";

/**
 * Hook to fetch WebSocket statistics
 * @returns Query result containing WebSocket stats
 */
export const useWebSocketStatsQuery = () => {
	return useQuery({
		queryKey: ["websocket", "stats"],
		queryFn: async (): Promise<WebSocketStats> => {
			return await webSocketApi.getStats();
		},
		staleTime: 10 * 1000,
		gcTime: 2 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 2,
	});
};

/**
 * Hook to fetch WebSocket connections
 * @returns Query result containing WebSocket connections data
 */
export const useWebSocketConnectionsQuery = () => {
	return useQuery({
		queryKey: ["websocket", "connections"],
		queryFn: async (): Promise<WebSocketConnectionsResponse> => {
			return await webSocketApi.getConnections();
		},
		staleTime: 5 * 1000,
		gcTime: 2 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 2,
	});
};

/**
 * Hook to fetch WebSocket activity
 * @returns Query result containing WebSocket activity data
 */
export const useWebSocketActivityQuery = () => {
	return useQuery({
		queryKey: ["websocket", "activity"],
		queryFn: async (): Promise<WebSocketActivityResponse> => {
			return await webSocketApi.getActivity();
		},
		staleTime: 15 * 1000,
		gcTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 2,
	});
};

/**
 * Hook to disconnect a WebSocket connection
 * @returns Mutation function for disconnecting connections
 */
export const useDisconnectConnectionMutation = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (connectionId: string) => {
			return await webSocketApi.disconnectConnection(connectionId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["websocket", "connections"] });
			queryClient.invalidateQueries({ queryKey: ["websocket", "stats"] });
			queryClient.invalidateQueries({ queryKey: ["websocket", "activity"] });
			toast({
				title: "Connection Disconnected",
				description:
					"The WebSocket connection has been successfully disconnected.",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error.message || "Failed to disconnect connection",
				variant: "destructive",
			});
		},
	});
};

/**
 * Hook to broadcast messages to WebSocket connections
 * @returns Mutation function for broadcasting messages
 */
export const useBroadcastMessageMutation = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (
			data: BroadcastMessageRequest,
		): Promise<BroadcastMessageResponse> => {
			return await webSocketApi.broadcastMessage(data);
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["websocket", "activity"] });
			toast({
				title: "Message Broadcasted",
				description: `Message sent to ${data.sent_to_connections} connection(s).`,
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error.message || "Failed to broadcast message",
				variant: "destructive",
			});
		},
	});
};

/**
 * Combined hook for all WebSocket data
 * @returns Object containing all WebSocket queries and their states
 */
export const useWebSocketData = () => {
	const statsQuery = useWebSocketStatsQuery();
	const connectionsQuery = useWebSocketConnectionsQuery();
	const activityQuery = useWebSocketActivityQuery();

	return {
		stats: statsQuery.data,
		connections: connectionsQuery.data,
		activity: activityQuery.data,
		isLoading:
			statsQuery.isLoading ||
			connectionsQuery.isLoading ||
			activityQuery.isLoading,
		isStatsLoading: statsQuery.isLoading,
		isConnectionsLoading: connectionsQuery.isLoading,
		isActivityLoading: activityQuery.isLoading,

		error: statsQuery.error || connectionsQuery.error || activityQuery.error,
		statsError: statsQuery.error,
		connectionsError: connectionsQuery.error,
		activityError: activityQuery.error,

		refetchAll: () => {
			statsQuery.refetch();
			connectionsQuery.refetch();
			activityQuery.refetch();
		},
		refetchStats: statsQuery.refetch,
		refetchConnections: connectionsQuery.refetch,
		refetchActivity: activityQuery.refetch,

		queries: {
			stats: statsQuery,
			connections: connectionsQuery,
			activity: activityQuery,
		},
	};
};
