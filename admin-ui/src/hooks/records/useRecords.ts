import { useQuery } from "@tanstack/react-query";
import { recordsApi } from "@/lib/api";
import type { QueryOptions } from "@/types/api";

interface UseRecordsOptions {
	collectionName: string;
	page?: number;
	limit?: number;
	search?: string;
	filters?: Record<string, any>;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
	enabled?: boolean;
}

/**
 * Hook for fetching records from a specific collection
 * Replaces records store functionality
 */
export const useRecords = ({
	collectionName,
	page = 1,
	limit = 20,
	search,
	filters,
	sortBy,
	sortOrder = "desc",
	enabled = true,
}: UseRecordsOptions) => {
	return useQuery({
		queryKey: [
			"records",
			collectionName,
			{
				page,
				limit,
				search,
				filters,
				sortBy,
				sortOrder,
			},
		],
		queryFn: async () => {
			const queryOptions: QueryOptions = {
				limit,
				offset: (page - 1) * limit,
				search,
				filter: filters
					? Object.entries(filters)
							.map(([key, value]) => `${key}:eq:${value}`)
							.join(",")
					: undefined,
				sort: sortBy
					? `${sortOrder === "desc" ? "-" : ""}${sortBy}`
					: undefined,
			};

			return await recordsApi.list(collectionName, queryOptions);
		},
		enabled: enabled && !!collectionName,
		staleTime: 30 * 1000, // 30 seconds
		gcTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
		retry: 2,
	});
};

/**
 * Hook for fetching a single record by ID
 */
export const useRecord = (collectionName: string, recordId: number) => {
	return useQuery({
		queryKey: ["records", collectionName, recordId],
		queryFn: async () => {
			return await recordsApi.get(collectionName, recordId);
		},
		enabled: !!collectionName && !!recordId,
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
		refetchOnWindowFocus: false,
	});
};

/**
 * Hook for fetching all records across collections (admin view)
 */
export const useAllRecords = ({
	page = 1,
	limit = 20,
	search,
	filters,
	sortBy,
	sortOrder = "desc",
	enabled = true,
}: Omit<UseRecordsOptions, "collectionName">) => {
	return useQuery({
		queryKey: [
			"records",
			"all",
			{
				page,
				limit,
				search,
				filters,
				sortBy,
				sortOrder,
			},
		],
		queryFn: async () => {
			const queryOptions: QueryOptions = {
				limit,
				offset: (page - 1) * limit,
				search,
				filter: filters
					? Object.entries(filters)
							.map(([key, value]) => `${key}:eq:${value}`)
							.join(",")
					: undefined,
				sort: sortBy
					? `${sortOrder === "desc" ? "-" : ""}${sortBy}`
					: undefined,
			};

			return await recordsApi.listAll(queryOptions);
		},
		enabled,
		staleTime: 30 * 1000, // 30 seconds
		gcTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
		retry: 2,
	});
};
