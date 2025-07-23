import { useQuery } from "@tanstack/react-query";
import { collectionsApi, permissionsApi } from "@/lib/api";
import type { Collection } from "@/types/api";

interface CollectionsQueryData {
	collections: Collection[];
	recordCounts: Record<string, number>;
}

/**
 * Hook for fetching all accessible collections with record counts
 * Replaces collections store functionality
 */
export const useCollections = () => {
	return useQuery({
		queryKey: ["collections"],
		queryFn: async (): Promise<CollectionsQueryData> => {
			// Fetch collections
			const collections = await permissionsApi.getMyAccessibleCollections();

			// Fetch record counts from stats endpoint
			let recordCounts: Record<string, number> = {};
			try {
				const stats = await collectionsApi.getStats();
				recordCounts = stats.records_per_collection;
			} catch (error) {
				console.warn("Failed to fetch collection stats:", error);
				// Fallback: set all counts to 0
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
		gcTime: 10 * 60 * 1000, // 10 minutes
		refetchOnWindowFocus: false,
		retry: 2,
	});
};

/**
 * Hook for fetching a single collection by name
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
 * Hook for fetching collection statistics
 */
export const useCollectionStats = () => {
	return useQuery({
		queryKey: ["collections", "stats"],
		queryFn: () => collectionsApi.getStats(),
		staleTime: 30 * 1000, // 30 seconds
		gcTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
		refetchInterval: 60 * 1000, // Auto-refresh every minute
	});
};
