export { default as useAuthDefault, useAuth } from "@/hooks/utils/useAuth";
export {
	useCollectionStatsQuery,
	useDashboardStats,
	useHealthQuery,
	useWebSocketStatsQuery,
} from "@/hooks/utils/useDashboardQueries";
export { useDebounce } from "@/hooks/utils/useDebounce";
export { useMetricsQuery, useRawMetricsQuery } from "@/hooks/utils/useMetricsQuery";
export { usePrefetch } from "@/hooks/utils/usePrefetch";
export { useTheme } from "@/hooks/utils/useTheme";
export {
	useBroadcastMessageMutation,
	useDisconnectConnectionMutation,
	useWebSocketActivityQuery,
	useWebSocketConnectionsQuery,
	useWebSocketData,
	useWebSocketStatsQuery as useWebSocketStatsQueryNew,
} from "@/hooks/utils/useWebSocketQueries";
