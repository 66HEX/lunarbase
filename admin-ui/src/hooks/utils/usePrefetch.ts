import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
	collectionsApi,
	configurationApi,
	healthApi,
	metricsApi,
	recordsApi,
	usersApi,
	webSocketApi,
} from "@/lib/api";
import type { QueryOptions, UsersListParams } from "@/types/api";

/**
 * Hook for managing data prefetching for different application sections
 * Allows preloading data in the background when hovering over navigation elements
 */
export const usePrefetch = () => {
	const queryClient = useQueryClient();

	/**
	 * Prefetch users data with default parameters matching useUsersWithPagination
	 */
	const prefetchUsers = useCallback(async () => {
		await queryClient.prefetchQuery({
			queryKey: ["users", { page: 1, pageSize: 10, search: "" }],
			queryFn: async () => {
				const params: UsersListParams = {
					limit: 10,
					offset: 0,
					sort: "created_at",
					filter: undefined
				};

				const data = await usersApi.list(params);
				if (!data || !data.users || !data.pagination) {
					throw new Error("Unexpected response format");
				}
				return data;
			},
			staleTime: 30 * 1000
		});
	}, [queryClient]);

	/**
	 * Prefetch collections data
	 */
	const prefetchCollections = useCallback(async () => {
		await queryClient.prefetchQuery({
			queryKey: ["collections"],
			queryFn: async () => {

				const collections = await collectionsApi.list();
				const collectionsData = collections.data;


				let recordCounts: Record<string, number> = {};
				try {
					const stats = await collectionsApi.getStats();
					recordCounts = stats.records_per_collection;
				} catch (error) {
					console.warn("Failed to fetch collection stats:", error);

					recordCounts = collectionsData.reduce(
						(acc, collection) => {
							acc[collection.name] = 0;
							return acc;
						},
						{} as Record<string, number>,
					);
				}

				return {
					collections: collectionsData,
					recordCounts,
				};
			},
			staleTime: 30 * 1000
		});
	}, [queryClient]);

	/**
	 * Prefetch all records data with default parameters matching useAllRecords
	 */
	const prefetchRecords = useCallback(async () => {
		await queryClient.prefetchQuery({
			queryKey: ["allRecords", 1, 20, "", undefined, undefined],
			queryFn: async () => {
				const queryOptions: QueryOptions = {
					limit: 20,
					offset: 0,
					sort: "-created_at"
				};

				return await recordsApi.listAll(queryOptions);
			},
			staleTime: 30 * 1000
		});
	}, [queryClient]);

	/**
	 * Prefetch records for a specific collection with exact same parameters as useCollectionRecords
	 */
	const prefetchCollectionRecords = useCallback(async (collectionName: string) => {

			const currentPage = 1;
			const pageSize = 10;
			const searchTerm = "";
			const sort: string | undefined = undefined;
			const filter: string | undefined = undefined;

			const offset = (currentPage - 1) * pageSize;

			const queryOptions: QueryOptions = {
				limit: pageSize,
				offset,
				sort: sort || "-created_at"
			};


			if (filter) {
				queryOptions.filter = filter;
			}

			await queryClient.prefetchQuery({
				queryKey: [
					"collectionRecords",
					collectionName,
					currentPage,
					pageSize,
					searchTerm,
					sort,
					filter,
				],
				queryFn: () => recordsApi.list(collectionName, queryOptions),
				staleTime: 30 * 1000
			});
		},
		[queryClient],
	);

	/**
	 * Prefetch collection data for a specific collection
	 */
	const prefetchCollection = useCallback(
		async (collectionName: string) => {
			await queryClient.prefetchQuery({
				queryKey: ["collections", collectionName],
				queryFn: async () => {
					const response = await collectionsApi.get(collectionName);
					return response.data;
				},
				staleTime: 5 * 60 * 1000
			});
		},
		[queryClient],
	);

	/**
	 * Prefetch WebSocket data (stats, connections, activity)
	 */
	const prefetchWebSocket = useCallback(async () => {

		await queryClient.prefetchQuery({
			queryKey: ["websocket", "stats"],
			queryFn: () => webSocketApi.getStats(),
			staleTime: 10 * 1000
		});


		await queryClient.prefetchQuery({
			queryKey: ["websocket", "connections"],
			queryFn: () => webSocketApi.getConnections(),
			staleTime: 10 * 1000
		});


		await queryClient.prefetchQuery({
			queryKey: ["websocket", "activity"],
			queryFn: () => webSocketApi.getActivity(),
			staleTime: 10 * 1000
		});
	}, [queryClient]);

	/**
	 * Prefetch application metrics
	 */
	const prefetchMetrics = useCallback(async () => {

		await queryClient.prefetchQuery({
			queryKey: ["metrics", "summary"],
			queryFn: () => metricsApi.getSummary(),
			staleTime: 30 * 1000
		});


		await queryClient.prefetchQuery({
			queryKey: ["metrics", "raw"],
			queryFn: () => metricsApi.getMetrics(),
			staleTime: 30 * 1000
		});
	}, [queryClient]);

	/**
	 * Prefetch application settings
	 */
	const prefetchSettings = useCallback(async () => {

		await queryClient.prefetchQuery({
			queryKey: ["settings"],
			queryFn: () => configurationApi.getAllSettings(),
			staleTime: 5 * 60 * 1000
		});


		const categories = ["database", "auth", "api"] as const;
		await Promise.all(
			categories.map((category) =>
				queryClient.prefetchQuery({
					queryKey: ["settings", category],
					queryFn: () => configurationApi.getSettingsByCategory(category),
					staleTime: 5 * 60 * 1000
				}),
			),
		);
	}, [queryClient]);

	/**
	 * Prefetch dashboard data (collections, websocket, health)
	 */
	const prefetchDashboard = useCallback(async () => {

		await queryClient.prefetchQuery({
			queryKey: ["dashboard", "collections"],
			queryFn: () => collectionsApi.getStats(),
			staleTime: 30 * 1000
		});


		await queryClient.prefetchQuery({
			queryKey: ["dashboard", "websocket"],
			queryFn: () => webSocketApi.getStats(),
			staleTime: 10 * 1000
		});


		await queryClient.prefetchQuery({
			queryKey: ["dashboard", "health"],
			queryFn: () => healthApi.getHealth(),
			staleTime: 15 * 1000
		});
	}, [queryClient]);

	return {
		prefetchUsers,
		prefetchCollections,
		prefetchRecords,
		prefetchCollectionRecords,
		prefetchCollection,
		prefetchWebSocket,
		prefetchMetrics,
		prefetchSettings,
		prefetchDashboard,
	};
};
