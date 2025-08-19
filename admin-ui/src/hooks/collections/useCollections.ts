import { useQuery } from "@tanstack/react-query";
import { collectionsApi, permissionsApi } from "@/lib/api";
import type { Collection } from "@/types/api";

interface CollectionsQueryData {
	collections: Collection[];
	recordCounts: Record<string, number>;
}

/**
 * Custom hook for fetching all accessible collections with record counts
 * Replaces collections store functionality
 * @returns Query object containing collections and record counts
 */
export const useCollections = () => {
	return useQuery({
		queryKey: ["collections"],
		queryFn: async (): Promise<CollectionsQueryData> => {
			const collections = await permissionsApi.getMyAccessibleCollections();
			let recordCounts: Record<string, number> = {};
			try {
				const stats = await collectionsApi.getStats();
				recordCounts = stats.records_per_collection;
			} catch (error) {
				console.warn("Failed to fetch collection stats:", error);
				recordCounts = collections.reduce(
					(acc, collection) => {
						acc[collection.name] = 0;
						return acc;
					},
					{} as Record<string, number>,
				);
			}

			return {
				collections,
				recordCounts,
			};
		},
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 2,
	});
};

/**
 * Custom hook for fetching a single collection by name
 * @param name - The name of the collection to fetch
 * @returns Query object containing the collection data
 */
export const useCollection = (name: string) => {
	return useQuery({
		queryKey: ["collections", name],
		queryFn: async () => {
			const response = await collectionsApi.get(name);
			return response.data;
		},
		enabled: !!name,
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
		refetchOnWindowFocus: false,
	});
};

/**
 * Custom hook for fetching collection statistics
 * @returns Query object containing collection statistics
 */
export const useCollectionStats = () => {
	return useQuery({
		queryKey: ["collections", "stats"],
		queryFn: () => collectionsApi.getStats(),
		staleTime: 30 * 1000,
		gcTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		refetchInterval: 60 * 1000,
	});
};
