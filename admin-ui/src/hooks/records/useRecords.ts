import { useQuery } from "@tanstack/react-query";
import { recordsApi } from "@/lib/api";
import type { QueryOptions } from "@/types/api";

interface UseRecordsOptions {
	collectionName: string;
	page?: number;
	limit?: number;
	search?: string;
	filters?: Record<string, unknown>;
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
		staleTime: 30 * 1000,
		gcTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 2,
	});
};

interface UseCollectionRecordsParams {
	collectionName: string;
	currentPage: number;
	pageSize: number;
	searchTerm?: string;
	sort?: string;
	filter?: string;
	enabled?: boolean;
}

/**
 * Hook for fetching records from a specific collection
 */
export const useCollectionRecords = ({
	collectionName,
	currentPage,
	pageSize,
	searchTerm,
	sort,
	filter,
	enabled = true,
}: UseCollectionRecordsParams) => {
	const offset = (currentPage - 1) * pageSize;

	const queryOptions: QueryOptions = {
		limit: pageSize,
		offset,
		sort: sort || "-created_at",
	};

	if (searchTerm && searchTerm.trim()) {
		queryOptions.search = searchTerm.trim();
	}

	if (filter) {
		queryOptions.filter = filter;
	}

	return useQuery({
		queryKey: ["collectionRecords", collectionName, currentPage, pageSize, searchTerm, sort, filter],
		queryFn: () => recordsApi.list(collectionName, queryOptions),
		placeholderData: (previousData) => previousData, // keepPreviousData equivalent
		staleTime: 30000,
		gcTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		enabled: enabled && !!collectionName,
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
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false,
	});
};

/**
 * Hook for fetching all records across collections (admin view)
 */
interface UseAllRecordsParams {
	currentPage: number;
	pageSize: number;
	searchTerm?: string;
	sort?: string;
	filter?: string;
}

export const useAllRecords = ({
	currentPage,
	pageSize,
	searchTerm,
	sort,
	filter,
}: UseAllRecordsParams) => {
	const offset = (currentPage - 1) * pageSize;

	const queryOptions: QueryOptions = {
		limit: pageSize,
		offset,
		sort: sort || "-created_at",
	};

	if (searchTerm && searchTerm.trim()) {
		queryOptions.search = searchTerm.trim();
	}

	if (filter) {
		queryOptions.filter = filter;
	}

	return useQuery({
		queryKey: ["allRecords", currentPage, pageSize, searchTerm, sort, filter],
		queryFn: () => recordsApi.listAll(queryOptions),
		placeholderData: (previousData) => previousData, // keepPreviousData equivalent
		staleTime: 30000,
		gcTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});
};
