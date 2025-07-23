// Export all hooks

export * from "./collections/useCollectionMutations";
export * from "./collections/useCollections";
export * from "./permissions/usePermissionMutations";
export * from "./permissions/usePermissions";
export * from "./permissions/useRoleMutations";
export * from "./records/useRecordMutations";
export * from "./records/useRecords";
export { useAllRecordsQuery } from "./useAllRecordsQuery";
export { default as useAuthDefault, useAuth } from "./useAuth";
export { useCollectionRecordsQuery } from "./useCollectionRecordsQuery";
export { useCollectionsQuery } from "./useCollectionsQuery";
export {
	useCollectionStatsQuery,
	useDashboardStats,
	useHealthQuery,
	useWebSocketStatsQuery,
} from "./useDashboardQueries";
export { useDebounce } from "./useDebounce";
export * from "./users/useUserMutations";
export * from "./users/useUsers";
export { useUsersQuery } from "./useUsersQuery";
export {
	useBroadcastMessageMutation,
	useDisconnectConnectionMutation,
	useWebSocketActivityQuery,
	useWebSocketConnectionsQuery,
	useWebSocketData,
	useWebSocketStatsQuery as useWebSocketStatsQueryNew,
} from "./useWebSocketQueries";
