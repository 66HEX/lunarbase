import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { webSocketApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import type {
	WebSocketStats,
	WebSocketConnectionsResponse,
	WebSocketActivityResponse,
	BroadcastMessageRequest,
	BroadcastMessageResponse,
} from "@/types/api";

// Hook for WebSocket stats
export const useWebSocketStatsQuery = () => {
	return useQuery({
		queryKey: ["websocket", "stats"],
		queryFn: async (): Promise<WebSocketStats> => {
			return await webSocketApi.getStats();
		},
		staleTime: 10 * 1000, // 10 seconds
		gcTime: 2 * 60 * 1000, // 2 minutes
		refetchOnWindowFocus: false,
		retry: 2,
	});
};

// Hook for WebSocket connections
export const useWebSocketConnectionsQuery = () => {
	return useQuery({
		queryKey: ["websocket", "connections"],
		queryFn: async (): Promise<WebSocketConnectionsResponse> => {
			return await webSocketApi.getConnections();
		},
		staleTime: 5 * 1000, // 5 seconds
		gcTime: 2 * 60 * 1000, // 2 minutes
		refetchOnWindowFocus: false,
		retry: 2,
	});
};

// Hook for WebSocket activity
export const useWebSocketActivityQuery = () => {
	return useQuery({
		queryKey: ["websocket", "activity"],
		queryFn: async (): Promise<WebSocketActivityResponse> => {
			return await webSocketApi.getActivity();
		},
		staleTime: 15 * 1000, // 15 seconds
		gcTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
		retry: 2,
	});
};

// Hook for disconnecting a connection
export const useDisconnectConnectionMutation = () => {
	const queryClient = useQueryClient();
	const { toast } = useToast();

	return useMutation({
		mutationFn: async (connectionId: string) => {
			return await webSocketApi.disconnectConnection(connectionId);
		},
		onSuccess: () => {
			// Invalidate connections query to refresh the list
			queryClient.invalidateQueries({ queryKey: ["websocket", "connections"] });
			queryClient.invalidateQueries({ queryKey: ["websocket", "stats"] });
			queryClient.invalidateQueries({ queryKey: ["websocket", "activity"] });
			toast({
				title: "Connection Disconnected",
				description: "The WebSocket connection has been successfully disconnected.",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to disconnect connection",
				variant: "destructive",
			});
		},
	});
};

// Hook for broadcasting messages
export const useBroadcastMessageMutation = () => {
	const queryClient = useQueryClient();
	const { toast } = useToast();

	return useMutation({
		mutationFn: async (data: BroadcastMessageRequest): Promise<BroadcastMessageResponse> => {
			return await webSocketApi.broadcastMessage(data);
		},
		onSuccess: (data) => {
			// Invalidate activity query to show the new broadcast
			queryClient.invalidateQueries({ queryKey: ["websocket", "activity"] });
			toast({
				title: "Message Broadcasted",
				description: `Message sent to ${data.sent_to_connections} connection(s).`,
			});
		},
		onError: (error: any) => {
			toast({
				title: "Error",
				description: error.message || "Failed to broadcast message",
				variant: "destructive",
			});
		},
	});
};

// Combined hook for all WebSocket data
export const useWebSocketData = () => {
	const statsQuery = useWebSocketStatsQuery();
	const connectionsQuery = useWebSocketConnectionsQuery();
	const activityQuery = useWebSocketActivityQuery();

	return {
		// Data
		stats: statsQuery.data,
		connections: connectionsQuery.data,
		activity: activityQuery.data,

		// Loading states
		isLoading: statsQuery.isLoading || connectionsQuery.isLoading || activityQuery.isLoading,
		isStatsLoading: statsQuery.isLoading,
		isConnectionsLoading: connectionsQuery.isLoading,
		isActivityLoading: activityQuery.isLoading,

		// Error states
		error: statsQuery.error || connectionsQuery.error || activityQuery.error,
		statsError: statsQuery.error,
		connectionsError: connectionsQuery.error,
		activityError: activityQuery.error,

		// Refetch functions
		refetchAll: () => {
			statsQuery.refetch();
			connectionsQuery.refetch();
			activityQuery.refetch();
		},
		refetchStats: statsQuery.refetch,
		refetchConnections: connectionsQuery.refetch,
		refetchActivity: activityQuery.refetch,

		// Individual query objects for advanced usage
		queries: {
			stats: statsQuery,
			connections: connectionsQuery,
			activity: activityQuery,
		},
	};
};