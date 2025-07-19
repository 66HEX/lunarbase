// Collections Store with Persist Middleware
import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { collectionsApi, permissionsApi } from "@/lib/api";
import type {
	Collection,
	CollectionPermissions,
	CreateCollectionRequest,
	UpdateCollectionRequest,
} from "@/types/api";

interface CollectionsState {
	// State
	collections: Collection[];
	selectedCollection: Collection | null;
	stats: any | null;
	recordCounts: Record<string, number>;
	loading: boolean;
	error: string | null;
	lastFetched: number | null;

	// Cache settings
	cacheTimeout: number; // 5 minutes
}

interface CollectionsActions {
	// Actions
	fetchCollections: (force?: boolean) => Promise<void>;
	fetchCollection: (name: string) => Promise<void>;
	createCollection: (data: CreateCollectionRequest) => Promise<Collection>;
	updateCollection: (
		name: string,
		data: UpdateCollectionRequest,
	) => Promise<Collection>;
	deleteCollection: (name: string) => Promise<void>;
	saveCollectionPermissions: (
		collectionName: string,
		permissions: CollectionPermissions,
	) => Promise<void>;
	fetchStats: () => Promise<void>;
	fetchRecordCount: (collectionName: string) => Promise<void>;
	setSelectedCollection: (collection: Collection | null) => void;
	clearError: () => void;
	invalidateCache: () => void;
}

type CollectionsStore = CollectionsState & CollectionsActions;

export const useCollectionsStore = create<CollectionsStore>()(
	devtools(
		immer(
			persist(
				(set, get) => ({
					// Initial state
					collections: [],
					selectedCollection: null,
					stats: null,
					recordCounts: {},
					loading: false,
					error: null,
					lastFetched: null,
					cacheTimeout: 5 * 60 * 1000, // 5 minutes

					// Actions
					fetchCollections: async (force = false) => {
						const state = get();
						const now = Date.now();

						// Check cache validity
						if (!force && state.lastFetched && state.collections.length > 0) {
							const cacheAge = now - state.lastFetched;
							if (cacheAge < state.cacheTimeout) {
								return; // Use cached data
							}
						}

						set((state) => {
							state.loading = true;
							state.error = null;
						});

						try {
							const collections =
								await permissionsApi.getMyAccessibleCollections();

							set((state) => {
								state.collections = collections;
								state.loading = false;
								state.lastFetched = now;
							});

							// Fetch record counts from stats endpoint
							try {
								const stats = await collectionsApi.getStats();
								set((state) => {
									state.recordCounts = stats.records_per_collection;
								});
							} catch (error) {
								console.warn("Failed to fetch collection stats:", error);
								// Fallback: set all counts to 0
								const recordCountsMap = collections.reduce(
									(acc, collection) => {
										acc[collection.name] = 0;
										return acc;
									},
									{} as Record<string, number>,
								);
								set((state) => {
									state.recordCounts = recordCountsMap;
								});
							}
						} catch (error: any) {
							set((state) => {
								state.loading = false;
								state.error = error.message || "Failed to fetch collections";
							});
						}
					},

					fetchCollection: async (name: string) => {
						set((state) => {
							state.loading = true;
							state.error = null;
						});

						try {
							const response = await collectionsApi.get(name);
							const collection = response.data;

							set((state) => {
								state.selectedCollection = collection;
								state.loading = false;

								// Update collection in the list if it exists
								const index = state.collections.findIndex(
									(c) => c.name === name,
								);
								if (index !== -1) {
									state.collections[index] = collection;
								}
							});
						} catch (error: any) {
							set((state) => {
								state.loading = false;
								state.error = error.message || "Failed to fetch collection";
							});
						}
					},

					createCollection: async (data: CreateCollectionRequest) => {
						set((state) => {
							state.loading = true;
							state.error = null;
						});

						// Optimistic update
						const optimisticCollection: Collection = {
							id: -1, // Temporary ID for optimistic update
							name: data.name,
							schema: data.schema,
							is_system: false, // New collections are never system collections
							created_at: new Date().toISOString(),
							updated_at: new Date().toISOString(),
						};

						set((state) => {
							state.collections.push(optimisticCollection);
							state.recordCounts[optimisticCollection.name] = 0;
						});

						try {
							const collection = await collectionsApi.create(data);

							set((state) => {
								// Replace optimistic collection with real one
								const index = state.collections.findIndex(
									(c) => c.name === data.name,
								);
								if (index !== -1) {
									state.collections[index] = collection;
								}
								state.loading = false;
							});

							return collection;
						} catch (error: any) {
							// Rollback optimistic update
							set((state) => {
								state.collections = state.collections.filter(
									(c) => c.name !== data.name,
								);
								delete state.recordCounts[data.name];
								state.loading = false;
								state.error = error.message || "Failed to create collection";
							});
							throw error;
						}
					},

					updateCollection: async (
						name: string,
						data: UpdateCollectionRequest,
					) => {
						set((state) => {
							state.loading = true;
							state.error = null;
						});

						// Store original collection for rollback
						const originalCollection = get().collections.find(
							(c) => c.name === name,
						);
						const originalSelectedCollection = get().selectedCollection;

						// Optimistic update
						const optimisticCollection: Collection = {
							...originalCollection!,
							...data,
							updated_at: new Date().toISOString(),
						};

						set((state) => {
							const index = state.collections.findIndex((c) => c.name === name);
							if (index !== -1) {
								state.collections[index] = optimisticCollection;
							}

							if (state.selectedCollection?.name === name) {
								state.selectedCollection = optimisticCollection;
							}
						});

						try {
							const collection = await collectionsApi.update(name, data);

							set((state) => {
								const index = state.collections.findIndex(
									(c) => c.name === name,
								);
								if (index !== -1) {
									state.collections[index] = collection;
								}

								if (state.selectedCollection?.name === name) {
									state.selectedCollection = collection;
								}

								state.loading = false;
							});

							return collection;
						} catch (error: any) {
							// Rollback optimistic update
							set((state) => {
								if (originalCollection) {
									const index = state.collections.findIndex(
										(c) => c.name === name,
									);
									if (index !== -1) {
										state.collections[index] = originalCollection;
									}
								}

								if (originalSelectedCollection?.name === name) {
									state.selectedCollection = originalSelectedCollection;
								}

								state.loading = false;
								state.error = error.message || "Failed to update collection";
							});
							throw error;
						}
					},

					deleteCollection: async (name: string) => {
						set((state) => {
							state.loading = true;
							state.error = null;
						});

						// Store original data for rollback
						const originalCollections = get().collections;
						const originalRecordCounts = get().recordCounts;
						const originalSelectedCollection = get().selectedCollection;

						// Optimistic update
						set((state) => {
							state.collections = state.collections.filter(
								(c) => c.name !== name,
							);
							delete state.recordCounts[name];

							if (state.selectedCollection?.name === name) {
								state.selectedCollection = null;
							}
						});

						try {
							await collectionsApi.delete(name);

							set((state) => {
								state.loading = false;
							});
						} catch (error: any) {
							// Rollback optimistic update
							set((state) => {
								state.collections = originalCollections;
								state.recordCounts = originalRecordCounts;
								state.selectedCollection = originalSelectedCollection;
								state.loading = false;
								state.error = error.message || "Failed to delete collection";
							});
							throw error;
						}
					},

					fetchStats: async () => {
						try {
							const stats = await collectionsApi.getStats();
							set((state) => {
								state.stats = stats;
							});
						} catch (error: any) {
							console.error("Failed to fetch collection stats:", error);
						}
					},

					fetchRecordCount: async (collectionName: string) => {
						try {
							const stats = await collectionsApi.getStats();
							const count = stats.records_per_collection[collectionName] || 0;
							set((state) => {
								state.recordCounts[collectionName] = count;
							});
						} catch (error: any) {
							console.error(
								`Failed to fetch record count for ${collectionName}:`,
								error,
							);
							set((state) => {
								state.recordCounts[collectionName] = 0;
							});
						}
					},

					setSelectedCollection: (collection: Collection | null) => {
						set((state) => {
							state.selectedCollection = collection;
						});
					},

					clearError: () => {
						set((state) => {
							state.error = null;
						});
					},

					saveCollectionPermissions: async (
						collectionName: string,
						permissions: CollectionPermissions,
					) => {
						set((state) => {
							state.loading = true;
							state.error = null;
						});

						try {
							// Save role-based permissions
							for (const [roleName, rolePermissions] of Object.entries(
								permissions.role_permissions,
							)) {
								await permissionsApi.setCollectionPermission({
									collection_name: collectionName,
									role_name: roleName,
									can_create: rolePermissions.can_create,
									can_read: rolePermissions.can_read,
									can_update: rolePermissions.can_update,
									can_delete: rolePermissions.can_delete,
									can_list: rolePermissions.can_list,
								});
							}

							// Save user-specific permissions
							for (const [userId, userPermissions] of Object.entries(
								permissions.user_permissions,
							)) {
								await permissionsApi.setUserCollectionPermissions({
									collection_name: collectionName,
									user_id: parseInt(userId),
									can_create: userPermissions.can_create,
									can_read: userPermissions.can_read,
									can_update: userPermissions.can_update,
									can_delete: userPermissions.can_delete,
									can_list: userPermissions.can_list,
								});
							}

							// Update the collection in the store with new permissions
							set((state) => {
								const index = state.collections.findIndex(
									(c) => c.name === collectionName,
								);
								if (index !== -1) {
									state.collections[index] = {
										...state.collections[index],
										permissions: permissions,
									};
								}

								if (state.selectedCollection?.name === collectionName) {
									state.selectedCollection = {
										...state.selectedCollection,
										permissions: permissions,
									};
								}

								state.loading = false;
							});
						} catch (error: any) {
							set((state) => {
								state.loading = false;
								state.error = error.message || "Failed to save permissions";
							});
							throw error;
						}
					},

					invalidateCache: () => {
						set((state) => {
							state.lastFetched = null;
						});
					},
				}),
				{
					name: "lunarbase-collections-storage",
					storage: createJSONStorage(() => localStorage),
					partialize: (state) => ({
						collections: state.collections,
						recordCounts: state.recordCounts,
						lastFetched: state.lastFetched,
					}),
				},
			),
		),
		{
			name: "collections-store",
		},
	),
);
