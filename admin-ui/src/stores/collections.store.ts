// Collections Store Slice
import type { StateCreator } from "zustand";
import { collectionsApi, permissionsApi, recordsApi } from "@/lib/api";
import type {
	Collection,
	CreateCollectionRequest,
	UpdateCollectionRequest,
} from "@/types/api";
import type { CollectionsStore, RootStore } from "@/types/store.types";

export const createCollectionsSlice: StateCreator<
	RootStore,
	[
		["zustand/devtools", never],
		["zustand/subscribeWithSelector", never],
		["zustand/immer", never],
	],
	[],
	CollectionsStore
> = (set) => ({
	// Initial state
	collections: [],
	selectedCollection: null,
	stats: null,
	recordCounts: {},
	loading: false,
	error: null,

	// Actions
	fetchCollections: async () => {
		set((state) => {
			state.collections.loading = true;
			state.collections.error = null;
		});

		try {
			const collections = await permissionsApi.getMyAccessibleCollections();
			set((state) => {
				state.collections.collections = collections;
				state.collections.loading = false;
			});

			// Fetch record counts for each collection
			const recordCountPromises = collections.map(async (collection) => {
				try {
					const response = await recordsApi.list(collection.name, { limit: 1 });
					return {
						name: collection.name,
						count: response.pagination.total_count,
					};
				} catch {
					return { name: collection.name, count: 0 };
				}
			});

			const recordCounts = await Promise.all(recordCountPromises);
			const recordCountsMap = recordCounts.reduce(
				(acc, { name, count }) => {
					acc[name] = count;
					return acc;
				},
				{} as Record<string, number>,
			);

			set((state) => {
				state.collections.recordCounts = recordCountsMap;
			});
		} catch (error: any) {
			set((state) => {
				state.collections.loading = false;
				state.collections.error =
					error.message || "Failed to fetch collections";
			});
		}
	},

	fetchCollection: async (name: string) => {
		set((state) => {
			state.collections.loading = true;
			state.collections.error = null;
		});

		try {
			const response = await collectionsApi.get(name);
			const collection = response.data;

			set((state) => {
				state.collections.selectedCollection = collection;
				state.collections.loading = false;

				// Update collection in the list if it exists
				const index = state.collections.collections.findIndex(
					(c) => c.name === name,
				);
				if (index !== -1) {
					state.collections.collections[index] = collection;
				}
			});
		} catch (error: any) {
			set((state) => {
				state.collections.loading = false;
				state.collections.error = error.message || "Failed to fetch collection";
			});
		}
	},

	createCollection: async (data: CreateCollectionRequest) => {
		set((state) => {
			state.collections.loading = true;
			state.collections.error = null;
		});

		try {
			const collection = await collectionsApi.create(data);

			set((state) => {
				state.collections.collections.push(collection);
				state.collections.recordCounts[collection.name] = 0;
				state.collections.loading = false;
			});
		} catch (error: any) {
			set((state) => {
				state.collections.loading = false;
				state.collections.error =
					error.message || "Failed to create collection";
			});
			throw error;
		}
	},

	updateCollection: async (name: string, data: UpdateCollectionRequest) => {
		set((state) => {
			state.collections.loading = true;
			state.collections.error = null;
		});

		try {
			const collection = await collectionsApi.update(name, data);

			set((state) => {
				const index = state.collections.collections.findIndex(
					(c) => c.name === name,
				);
				if (index !== -1) {
					state.collections.collections[index] = collection;
				}

				if (state.collections.selectedCollection?.name === name) {
					state.collections.selectedCollection = collection;
				}

				state.collections.loading = false;
			});
		} catch (error: any) {
			set((state) => {
				state.collections.loading = false;
				state.collections.error =
					error.message || "Failed to update collection";
			});
			throw error;
		}
	},

	deleteCollection: async (name: string) => {
		set((state) => {
			state.collections.loading = true;
			state.collections.error = null;
		});

		try {
			await collectionsApi.delete(name);

			set((state) => {
				state.collections.collections = state.collections.collections.filter(
					(c) => c.name !== name,
				);
				delete state.collections.recordCounts[name];

				if (state.collections.selectedCollection?.name === name) {
					state.collections.selectedCollection = null;
				}

				state.collections.loading = false;
			});
		} catch (error: any) {
			set((state) => {
				state.collections.loading = false;
				state.collections.error =
					error.message || "Failed to delete collection";
			});
			throw error;
		}
	},

	fetchStats: async () => {
		try {
			const stats = await collectionsApi.getStats();
			set((state) => {
				state.collections.stats = stats;
			});
		} catch (error: any) {
			console.error("Failed to fetch collection stats:", error);
		}
	},

	fetchRecordCount: async (collectionName: string) => {
		try {
			const response = await recordsApi.list(collectionName, { limit: 1 });
			set((state) => {
				state.collections.recordCounts[collectionName] =
					response.pagination.total_count;
			});
		} catch (error: any) {
			console.error(
				`Failed to fetch record count for ${collectionName}:`,
				error,
			);
		}
	},

	setSelectedCollection: (collection: Collection | null) => {
		set((state) => {
			state.collections.selectedCollection = collection;
		});
	},
});
