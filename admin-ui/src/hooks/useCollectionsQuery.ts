import { useQuery } from "@tanstack/react-query";
import { collectionsApi, permissionsApi } from "@/lib/api";
import type { Collection } from "@/types/api";

interface CollectionsQueryData {
	collections: Collection[];
	recordCounts: Record<string, number>;
}

export const useCollectionsQuery = () => {
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
		placeholderData: (previousData) => previousData, // keepPreviousData equivalent
		staleTime: 30 * 1000, // 30 seconds
		gcTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
	});
};
