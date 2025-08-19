import { useQuery } from "@tanstack/react-query";
import { collectionsApi, healthApi, webSocketApi } from "@/lib/api";
import type {
	CollectionStats,
	HealthResponse,
	WebSocketStats,
} from "@/types/api";

/**
 * Hook to fetch collection statistics for dashboard
 * @returns Query result containing collection stats
 */
export const useCollectionStatsQuery = () => {
	return useQuery({
		queryKey: ["dashboard", "collections"],
		queryFn: async (): Promise<CollectionStats> => {
			return await collectionsApi.getStats();
		},
		staleTime: 30 * 1000,
		gcTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});
};

/**
 * Hook to fetch WebSocket statistics for dashboard
 * @returns Query result containing WebSocket stats
 */
export const useWebSocketStatsQuery = () => {
	return useQuery({
		queryKey: ["dashboard", "websocket"],
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
 * Hook to fetch health statistics for dashboard
 * @returns Query result containing health data
 */
export const useHealthQuery = () => {
	return useQuery({
		queryKey: ["dashboard", "health"],
		queryFn: async (): Promise<HealthResponse> => {
			return await healthApi.getHealth();
		},
		staleTime: 15 * 1000,
		gcTime: 3 * 60 * 1000,
		refetchOnWindowFocus: false,
		refetchInterval: 30 * 1000,
		retry: 3,
	});
};

/**
 * Combined hook for all dashboard data
 * @returns Object containing all dashboard queries and their states
 */
export const useDashboardStats = () => {
	const collectionsQuery = useCollectionStatsQuery();
	const websocketQuery = useWebSocketStatsQuery();
	const healthQuery = useHealthQuery();

	return {
		collections: collectionsQuery.data,
		websocket: websocketQuery.data,
		health: healthQuery.data,
		isLoading:
			collectionsQuery.isLoading ||
			websocketQuery.isLoading ||
			healthQuery.isLoading,
		isCollectionsLoading: collectionsQuery.isLoading,
		isWebSocketLoading: websocketQuery.isLoading,
		isHealthLoading: healthQuery.isLoading,

		error: collectionsQuery.error || websocketQuery.error || healthQuery.error,
		collectionsError: collectionsQuery.error,
		websocketError: websocketQuery.error,
		healthError: healthQuery.error,

		refetchAll: () => {
			collectionsQuery.refetch();
			websocketQuery.refetch();
			healthQuery.refetch();
		},
		refetchCollections: collectionsQuery.refetch,
		refetchWebSocket: websocketQuery.refetch,
		refetchHealth: healthQuery.refetch,

		queries: {
			collections: collectionsQuery,
			websocket: websocketQuery,
			health: healthQuery,
		},
	};
};
