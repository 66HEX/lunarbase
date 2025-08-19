import { useQuery } from "@tanstack/react-query";
import { ownershipApi } from "@/lib/api";
import type {
	OwnedRecordsResponse,
	OwnershipCheckResponse,
	OwnershipStatsResponse,
} from "@/types/api";

/**
 * Hook for checking record ownership
 */
export const useOwnershipCheck = (
	collectionName: string,
	recordId: number,
	enabled = true,
) => {
	return useQuery<OwnershipCheckResponse>({
		queryKey: ["ownership", "check", collectionName, recordId],
		queryFn: (): Promise<OwnershipCheckResponse> =>
			ownershipApi.checkRecordOwnership(collectionName, recordId),
		enabled: enabled && !!collectionName && !!recordId,
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
		retry: 2,
	});
};

/**
 * Hook for fetching ownership statistics for a collection
 */
export const useOwnershipStats = (collectionName: string, enabled = true) => {
	return useQuery<OwnershipStatsResponse>({
		queryKey: ["ownership", "stats", collectionName],
		queryFn: (): Promise<OwnershipStatsResponse> =>
			ownershipApi.getOwnershipStats(collectionName),
		enabled: enabled && !!collectionName,
		staleTime: 2 * 60 * 1000,
		gcTime: 5 * 60 * 1000,
		retry: 2,
	});
};

/**
 * Hook for fetching current user's owned records in a collection
 */
export const useMyOwnedRecords = (
	collectionName: string,
	limit?: number,
	offset?: number,
	enabled = true,
) => {
	return useQuery<OwnedRecordsResponse>({
		queryKey: ["ownership", "my-records", collectionName, limit, offset],
		queryFn: (): Promise<OwnedRecordsResponse> =>
			ownershipApi.getMyOwnedRecords(collectionName, limit, offset),
		enabled: enabled && !!collectionName,
		staleTime: 1 * 60 * 1000,
		gcTime: 5 * 60 * 1000,
		retry: 2,
	});
};

/**
 * Hook for fetching a specific user's owned records in a collection
 */
export const useUserOwnedRecords = (
	collectionName: string,
	userId: number,
	limit?: number,
	offset?: number,
	enabled = true,
) => {
	return useQuery<OwnedRecordsResponse>({
		queryKey: [
			"ownership",
			"user-records",
			collectionName,
			userId,
			limit,
			offset,
		],
		queryFn: (): Promise<OwnedRecordsResponse> =>
			ownershipApi.getUserOwnedRecords(collectionName, userId, limit, offset),
		enabled: enabled && !!collectionName && !!userId,
		staleTime: 1 * 60 * 1000,
		gcTime: 5 * 60 * 1000,
		retry: 2,
	});
};
