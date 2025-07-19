import { useQuery } from "@tanstack/react-query";
import { metricsApi } from "@/lib/api";

export interface MetricsSummary {
	http_requests_total: number;
	active_websocket_connections: number;
	database_connections_active: number;
	timestamp: string;
}

export const useMetricsQuery = () => {
	return useQuery({
		queryKey: ["metrics", "summary"],
		queryFn: async (): Promise<MetricsSummary> => {
			return await metricsApi.getSummary();
		},
		refetchInterval: 5000, // Refresh every 5 seconds for real-time data
		staleTime: 1000, // Consider data stale after 1 second
		gcTime: 30 * 1000, // Keep in cache for 30 seconds
		refetchOnWindowFocus: true,
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
	});
};

export const useRawMetricsQuery = () => {
	return useQuery({
		queryKey: ["metrics", "raw"],
		queryFn: async (): Promise<string> => {
			return await metricsApi.getMetrics();
		},
		refetchInterval: 10000, // Refresh every 10 seconds
		staleTime: 5000, // Consider data stale after 5 seconds
		gcTime: 60 * 1000, // Keep in cache for 1 minute
		refetchOnWindowFocus: false,
		retry: 2,
	});
};
