import { useQuery } from "@tanstack/react-query";
import { collectionsApi, healthApi, webSocketApi } from "@/lib/api";
import type {
	CollectionStats,
	HealthResponse,
	WebSocketStats,
} from "@/types/api";

// Hook for collection stats
export const useCollectionStatsQuery = () => {
	return useQuery({
		queryKey: ["dashboard", "collections"],
		queryFn: async (): Promise<CollectionStats> => {
			return await collectionsApi.getStats();
		},
		staleTime: 30 * 1000, // 30 seconds
		gcTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
	});
};

// Hook for WebSocket stats
export const useWebSocketStatsQuery = () => {
	return useQuery({
		queryKey: ["dashboard", "websocket"],
		queryFn: async (): Promise<WebSocketStats> => {
			return await webSocketApi.getStats();
		},
		staleTime: 10 * 1000, // 10 seconds (more frequent for real-time data)
		gcTime: 2 * 60 * 1000, // 2 minutes
		refetchOnWindowFocus: false,
		retry: 2, // Retry failed requests
	});
};

// Hook for health stats
export const useHealthQuery = () => {
	return useQuery({
		queryKey: ["dashboard", "health"],
		queryFn: async (): Promise<HealthResponse> => {
			return await healthApi.getHealth();
		},
		staleTime: 15 * 1000, // 15 seconds
		gcTime: 3 * 60 * 1000, // 3 minutes
		refetchOnWindowFocus: false,
		refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
		retry: 3, // Retry failed requests
	});
};

// Combined hook for all dashboard data
export const useDashboardStats = () => {
	const collectionsQuery = useCollectionStatsQuery();
	const websocketQuery = useWebSocketStatsQuery();
	const healthQuery = useHealthQuery();

	return {
		// Data
		collections: collectionsQuery.data,
		websocket: websocketQuery.data,
		health: healthQuery.data,

		// Loading states
		isLoading:
			collectionsQuery.isLoading ||
			websocketQuery.isLoading ||
			healthQuery.isLoading,
		isCollectionsLoading: collectionsQuery.isLoading,
		isWebSocketLoading: websocketQuery.isLoading,
		isHealthLoading: healthQuery.isLoading,

		// Error states
		error: collectionsQuery.error || websocketQuery.error || healthQuery.error,
		collectionsError: collectionsQuery.error,
		websocketError: websocketQuery.error,
		healthError: healthQuery.error,

		// Refetch functions
		refetchAll: () => {
			collectionsQuery.refetch();
			websocketQuery.refetch();
			healthQuery.refetch();
		},
		refetchCollections: collectionsQuery.refetch,
		refetchWebSocket: websocketQuery.refetch,
		refetchHealth: healthQuery.refetch,

		// Individual query objects for advanced usage
		queries: {
			collections: collectionsQuery,
			websocket: websocketQuery,
			health: healthQuery,
		},
	};
};
