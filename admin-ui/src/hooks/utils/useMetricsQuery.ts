import { useQuery } from "@tanstack/react-query";
import { metricsApi } from "@/lib/api";

export interface MetricsSummary {
	http_requests_total: number;
	active_websocket_connections: number;
	database_connections_active: number;
	timestamp: string;
}

/**
 * Hook to fetch application metrics summary
 * @returns Query result containing metrics summary data
 */
export const useMetricsQuery = () => {
	return useQuery({
		queryKey: ["metrics", "summary"],
		queryFn: async (): Promise<MetricsSummary> => {
			return await metricsApi.getSummary();
		},
		refetchInterval: 5000,
		staleTime: 1000,
		gcTime: 30 * 1000,
		refetchOnWindowFocus: true,
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
	});
};

/**
 * Hook to fetch raw metrics data
 * @returns Query result containing raw metrics string
 */
export const useRawMetricsQuery = () => {
	return useQuery({
		queryKey: ["metrics", "raw"],
		queryFn: async (): Promise<string> => {
			return await metricsApi.getMetrics();
		},
		refetchInterval: 10000,
		staleTime: 5000,
		gcTime: 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 2,
	});
};
