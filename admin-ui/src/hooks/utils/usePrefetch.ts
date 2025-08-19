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
 * Includes cache checking to prevent unnecessary prefetching
 */
export const usePrefetch = () => {
	const queryClient = useQueryClient();

	/**
	 * Check if data exists in cache and is not stale
	 */
	const isDataFresh = useCallback((queryKey: unknown[], staleTime: number) => {
		const query = queryClient.getQueryState(queryKey);
		if (!query || !query.data) return false;
		
		const now = Date.now();
		const dataUpdatedAt = query.dataUpdatedAt || 0;
		return (now - dataUpdatedAt) < staleTime;
	}, [queryClient]);

	/**
	 * Prefetch users data with default parameters matching useUsersWithPagination
	 */
	const prefetchUsers = useCallback(async () => {
		const queryKey = ["users", { page: 1, pageSize: 10, search: "" }];
		const staleTime = 30 * 1000;
		
		if (isDataFresh(queryKey, staleTime)) {
			return;
		}
		
		await queryClient.prefetchQuery({
			queryKey,
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
			staleTime
		});
	}, [queryClient]);

	/**
	 * Prefetch collections data
	 */
	const prefetchCollections = useCallback(async () => {
		const queryKey = ["collections"];
		const staleTime = 30 * 1000;
		
		if (isDataFresh(queryKey, staleTime)) {
			return;
		}
		
		await queryClient.prefetchQuery({
			queryKey,
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
			staleTime
		});
	}, [queryClient]);

	/**
	 * Prefetch all records data with default parameters matching useAllRecords
	 */
	const prefetchRecords = useCallback(async () => {
		const queryKey = ["allRecords", 1, 20, "", undefined, undefined];
		const staleTime = 30 * 1000;
		
		if (isDataFresh(queryKey, staleTime)) {
			return;
		}
		
		await queryClient.prefetchQuery({
			queryKey,
			queryFn: async () => {
				const queryOptions: QueryOptions = {
					limit: 20,
					offset: 0,
					sort: "-created_at"
				};

				return await recordsApi.listAll(queryOptions);
			},
			staleTime
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
		const staleTime = 30 * 1000;

		const queryKey = [
			"collectionRecords",
			collectionName,
			currentPage,
			pageSize,
			searchTerm,
			sort,
			filter,
		];
		
		if (isDataFresh(queryKey, staleTime)) {
			return;
		}

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
				queryKey,
				queryFn: () => recordsApi.list(collectionName, queryOptions),
				staleTime
			});
		},
		[queryClient],
	);

	/**
	 * Prefetch collection data for a specific collection
	 */
	const prefetchCollection = useCallback(
		async (collectionName: string) => {
			const queryKey = ["collections", collectionName];
			const staleTime = 5 * 60 * 1000;
			
			if (isDataFresh(queryKey, staleTime)) {
				return;
			}
			
			await queryClient.prefetchQuery({
				queryKey,
				queryFn: async () => {
					const response = await collectionsApi.get(collectionName);
					return response.data;
				},
				staleTime
			});
		},
		[queryClient],
	);

	/**
	 * Prefetch WebSocket data (stats, connections, activity)
	 */
	const prefetchWebSocket = useCallback(async () => {
		const statsQueryKey = ["websocket", "stats"];
		const connectionsQueryKey = ["websocket", "connections"];
		const activityQueryKey = ["websocket", "activity"];
		const statsStaleTime = 10 * 1000;
		const connectionsStaleTime = 10 * 1000;
		const activityStaleTime = 10 * 1000;

		if (!isDataFresh(statsQueryKey, statsStaleTime)) {
			await queryClient.prefetchQuery({
				queryKey: statsQueryKey,
				queryFn: () => webSocketApi.getStats(),
				staleTime: statsStaleTime
			});
		}

		if (!isDataFresh(connectionsQueryKey, connectionsStaleTime)) {
			await queryClient.prefetchQuery({
				queryKey: connectionsQueryKey,
				queryFn: () => webSocketApi.getConnections(),
				staleTime: connectionsStaleTime
			});
		}

		if (!isDataFresh(activityQueryKey, activityStaleTime)) {
			await queryClient.prefetchQuery({
				queryKey: activityQueryKey,
				queryFn: () => webSocketApi.getActivity(),
				staleTime: activityStaleTime
			});
		}
	}, [queryClient]);

	/**
	 * Prefetch application metrics
	 */
	const prefetchMetrics = useCallback(async () => {
		const summaryQueryKey = ["metrics", "summary"];
		const rawQueryKey = ["metrics", "raw"];
		const staleTime = 30 * 1000;

		if (!isDataFresh(summaryQueryKey, staleTime)) {
			await queryClient.prefetchQuery({
				queryKey: summaryQueryKey,
				queryFn: () => metricsApi.getSummary(),
				staleTime
			});
		}

		if (!isDataFresh(rawQueryKey, staleTime)) {
			await queryClient.prefetchQuery({
				queryKey: rawQueryKey,
				queryFn: () => metricsApi.getMetrics(),
				staleTime
			});
		}
	}, [queryClient]);

	/**
	 * Prefetch application settings
	 */
	const prefetchSettings = useCallback(async () => {
		const allSettingsQueryKey = ["settings"];
		const staleTime = 5 * 60 * 1000;

		if (!isDataFresh(allSettingsQueryKey, staleTime)) {
			await queryClient.prefetchQuery({
				queryKey: allSettingsQueryKey,
				queryFn: () => configurationApi.getAllSettings(),
				staleTime
			});
		}

		const categories = ["database", "auth", "api"] as const;
		const categoryPromises = categories
			.filter((category) => {
				const categoryQueryKey = ["settings", category];
				return !isDataFresh(categoryQueryKey, staleTime);
			})
			.map((category) =>
				queryClient.prefetchQuery({
					queryKey: ["settings", category],
					queryFn: () => configurationApi.getSettingsByCategory(category),
					staleTime
				}),
			);
		
		await Promise.all(categoryPromises);
	}, [queryClient]);

	/**
	 * Prefetch dashboard data (collections, websocket, health)
	 */
	const prefetchDashboard = useCallback(async () => {
		const collectionsQueryKey = ["dashboard", "collections"];
		const websocketQueryKey = ["dashboard", "websocket"];
		const healthQueryKey = ["dashboard", "health"];
		const collectionsStaleTime = 30 * 1000;
		const websocketStaleTime = 10 * 1000;
		const healthStaleTime = 15 * 1000;

		if (!isDataFresh(collectionsQueryKey, collectionsStaleTime)) {
			await queryClient.prefetchQuery({
				queryKey: collectionsQueryKey,
				queryFn: () => collectionsApi.getStats(),
				staleTime: collectionsStaleTime
			});
		}

		if (!isDataFresh(websocketQueryKey, websocketStaleTime)) {
			await queryClient.prefetchQuery({
				queryKey: websocketQueryKey,
				queryFn: () => webSocketApi.getStats(),
				staleTime: websocketStaleTime
			});
		}

		if (!isDataFresh(healthQueryKey, healthStaleTime)) {
			await queryClient.prefetchQuery({
				queryKey: healthQueryKey,
				queryFn: () => healthApi.getHealth(),
				staleTime: healthStaleTime
			});
		}
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
