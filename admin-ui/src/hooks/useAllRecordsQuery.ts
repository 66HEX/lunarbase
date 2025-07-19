import { useQuery } from "@tanstack/react-query";
import { recordsApi } from "@/lib/api";
import type { QueryOptions } from "@/types/api";

interface UseAllRecordsQueryParams {
	currentPage: number;
	pageSize: number;
	searchTerm?: string;
	sort?: string;
	filter?: string;
}

export function useAllRecordsQuery({
	currentPage,
	pageSize,
	searchTerm,
	sort,
	filter,
}: UseAllRecordsQueryParams) {
	const offset = (currentPage - 1) * pageSize;

	const queryOptions: QueryOptions = {
		limit: pageSize,
		offset,
		sort: sort || "-created_at", // Default sort by created_at desc
	};

	// Add search/filter if provided
	if (searchTerm && searchTerm.trim()) {
		// Use filter parameter for searching by title field
		queryOptions.filter = `title:like:${searchTerm.trim()}`;
	}

	if (filter) {
		queryOptions.filter = filter;
	}

	return useQuery({
		queryKey: ["allRecords", currentPage, pageSize, searchTerm, sort, filter],
		queryFn: () => recordsApi.listAll(queryOptions),
		placeholderData: (previousData) => previousData, // keepPreviousData equivalent
		staleTime: 30000, // 30 seconds
		gcTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
	});
}
