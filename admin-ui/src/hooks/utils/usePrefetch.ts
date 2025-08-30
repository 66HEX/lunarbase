import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
	collectionsApi,
	configurationApi,
	healthApi,
	metricsApi,
	permissionsApi,
	recordsApi,
	rolesApi,
	usersApi,
	webSocketApi,
} from "@/lib/api";
import type {
	QueryOptions,
	RecordData,
	RecordWithCollection,
	UsersListParams,
} from "@/types/api";

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
	const isDataFresh = useCallback(
		(queryKey: unknown[], staleTime: number) => {
			const query = queryClient.getQueryState(queryKey);
			if (!query || !query.data) return false;

			const now = Date.now();
			const dataUpdatedAt = query.dataUpdatedAt || 0;
			return now - dataUpdatedAt < staleTime;
		},
		[queryClient],
	);

	/**
	 * Prefetch users data
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
					filter: undefined,
				};

				const data = await usersApi.list(params);
				if (!data || !data.users || !data.pagination) {
					throw new Error("Unexpected response format");
				}
				return data;
			},
			staleTime,
		});
	}, [queryClient, isDataFresh]);

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
			staleTime,
		});
	}, [queryClient, isDataFresh]);

	/**
	 * Prefetch users for ownership based on owner IDs from records
	 */
	const prefetchUsersForOwnership = useCallback(
		async (ownerIds: number[]) => {
			const uniqueOwnerIds = [...new Set(ownerIds.filter((id) => id > 0))];
			const staleTime = 5 * 60 * 1000;

			const prefetchPromises = uniqueOwnerIds.map(async (ownerId) => {
				const queryKey = ["users", "detail", ownerId];

				if (isDataFresh(queryKey, staleTime)) {
					return;
				}

				await queryClient.prefetchQuery({
					queryKey,
					queryFn: () => usersApi.get(ownerId),
					staleTime,
				});
			});

			await Promise.all(prefetchPromises);
		},
		[queryClient, isDataFresh],
	);

	/**
	 * Prefetch all records data with default parameters matching useAllRecords
	 * Also prefetches ownership user data
	 */
	const prefetchRecords = useCallback(async () => {
		const queryKey = ["allRecords", 1, 20, "", undefined, undefined];
		const staleTime = 30 * 1000;

		if (isDataFresh(queryKey, staleTime)) {
			return;
		}

		const recordsData = await queryClient.fetchQuery({
			queryKey,
			queryFn: async () => {
				const queryOptions: QueryOptions = {
					limit: 20,
					offset: 0,
					sort: "-created_at",
				};

				return await recordsApi.listAll(queryOptions);
			},
			staleTime,
		});

		if (recordsData?.records) {
			const ownerIds: number[] = [];
			recordsData.records.forEach((record: RecordWithCollection) => {
				if (record.data) {
					const getUserId = (data: RecordData): number | undefined => {
						return (
							(data.user_id as number) ||
							(data.created_by as number) ||
							(data.owner_id as number) ||
							(data.author_id as number)
						);
					};
					const ownerId = getUserId(record.data);
					if (ownerId) {
						ownerIds.push(ownerId);
					}
				}
			});

			if (ownerIds.length > 0) {
				await prefetchUsersForOwnership(ownerIds);
			}
		}
	}, [queryClient, isDataFresh, prefetchUsersForOwnership]);

	/**
	 * Prefetch records for a specific collection with exact same parameters as useCollectionRecords
	 * Also prefetches ownership user data
	 */
	const prefetchCollectionRecords = useCallback(
		async (collectionName: string) => {
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
				sort: sort || "-created_at",
			};

			if (filter) {
				queryOptions.filter = filter;
			}

			const recordsData = await queryClient.fetchQuery({
				queryKey,
				queryFn: () => recordsApi.list(collectionName, queryOptions),
				staleTime,
			});

			if (recordsData?.records) {
				const ownerIds: number[] = [];
				recordsData.records.forEach((record: RecordWithCollection) => {
					if (record.data) {
						const getUserId = (data: RecordData): number | undefined => {
							return (
								(data.user_id as number) ||
								(data.created_by as number) ||
								(data.owner_id as number) ||
								(data.author_id as number)
							);
						};
						const ownerId = getUserId(record.data);
						if (ownerId) {
							ownerIds.push(ownerId);
						}
					}
				});

				if (ownerIds.length > 0) {
					await prefetchUsersForOwnership(ownerIds);
				}
			}
		},
		[queryClient, isDataFresh, prefetchUsersForOwnership],
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
				staleTime,
			});
		},
		[queryClient, isDataFresh],
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
				staleTime: statsStaleTime,
			});
		}

		if (!isDataFresh(connectionsQueryKey, connectionsStaleTime)) {
			await queryClient.prefetchQuery({
				queryKey: connectionsQueryKey,
				queryFn: () => webSocketApi.getConnections(),
				staleTime: connectionsStaleTime,
			});
		}

		if (!isDataFresh(activityQueryKey, activityStaleTime)) {
			await queryClient.prefetchQuery({
				queryKey: activityQueryKey,
				queryFn: () => webSocketApi.getActivity(),
				staleTime: activityStaleTime,
			});
		}
	}, [queryClient, isDataFresh]);

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
				staleTime,
			});
		}

		if (!isDataFresh(rawQueryKey, staleTime)) {
			await queryClient.prefetchQuery({
				queryKey: rawQueryKey,
				queryFn: () => metricsApi.getMetrics(),
				staleTime,
			});
		}
	}, [queryClient, isDataFresh]);

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
				staleTime,
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
					staleTime,
				}),
			);

		await Promise.all(categoryPromises);
	}, [queryClient, isDataFresh]);

	/**
	 * Prefetch permissions data for a specific collection
	 */
	const prefetchPermissions = useCallback(
		async (collectionName: string) => {
			const rolesQueryKey = ["permissions", "roles"];
			const allPermissionsQueryKey = [
				"permissions",
				"collection-permissions",
				"all",
				collectionName,
			];
			const rolesStaleTime = 10 * 60 * 1000;
			const permissionsStaleTime = 5 * 60 * 1000;

			if (!isDataFresh(rolesQueryKey, rolesStaleTime)) {
				await queryClient.prefetchQuery({
					queryKey: rolesQueryKey,
					queryFn: () => rolesApi.list(),
					staleTime: rolesStaleTime,
				});
			}

			const rolesData = queryClient.getQueryData(rolesQueryKey) as Array<{
				id: number;
				name: string;
			}>;
			if (rolesData && rolesData.length > 0) {
				if (!isDataFresh(allPermissionsQueryKey, permissionsStaleTime)) {
					await queryClient.prefetchQuery({
						queryKey: allPermissionsQueryKey,
						queryFn: async () => {
							const permissionsPromises = rolesData.map(
								async (role: { id: number; name: string }) => {
									try {
										const permissions =
											await permissionsApi.getCollectionPermissions(
												role.name,
												collectionName,
											);
										return { roleName: role.name, permissions };
									} catch {
										return {
											roleName: role.name,
											permissions: {
												id: 0,
												role_id: role.id,
												collection_name: collectionName,
												can_create: false,
												can_read: false,
												can_update: false,
												can_delete: false,
												can_list: false,
												created_at: new Date().toISOString(),
												updated_at: new Date().toISOString(),
											},
										};
									}
								},
							);

							const results = await Promise.all(permissionsPromises);
							const permissionsMap: Record<string, unknown> = {};

							results.forEach(({ roleName, permissions }) => {
								permissionsMap[roleName] = permissions;
							});

							return permissionsMap;
						},
						staleTime: permissionsStaleTime,
					});
				}
			}
		},
		[queryClient, isDataFresh],
	);

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
				staleTime: collectionsStaleTime,
			});
		}

		if (!isDataFresh(websocketQueryKey, websocketStaleTime)) {
			await queryClient.prefetchQuery({
				queryKey: websocketQueryKey,
				queryFn: () => webSocketApi.getStats(),
				staleTime: websocketStaleTime,
			});
		}

		if (!isDataFresh(healthQueryKey, healthStaleTime)) {
			await queryClient.prefetchQuery({
				queryKey: healthQueryKey,
				queryFn: () => healthApi.getHealth(),
				staleTime: healthStaleTime,
			});
		}
	}, [queryClient, isDataFresh]);

	return {
		prefetchUsers,
		prefetchUsersForOwnership,
		prefetchCollections,
		prefetchRecords,
		prefetchCollectionRecords,
		prefetchCollection,
		prefetchWebSocket,
		prefetchMetrics,
		prefetchSettings,
		prefetchDashboard,
		prefetchPermissions,
	};
};
