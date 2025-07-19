// Records Store Slice
import type { StateCreator } from "zustand";
import { recordsApi } from "@/lib/api";
import type {
	CreateRecordRequest,
	QueryOptions,
	Record,
	UpdateRecordRequest,
} from "@/types/api";
import type { RecordsStore, RootStore } from "@/types/store.types";

// Collection cache interface
interface CollectionCache {
	records: Record[];
	currentPage: number;
	pageSize: number;
	totalCount: number;
	searchTerm: string;
	filters: { [key: string]: any };
	lastFetch: number;
	loading: boolean;
}

export const createRecordsSlice: StateCreator<
	RootStore,
	[
		["zustand/devtools", never],
		["zustand/subscribeWithSelector", never],
		["zustand/immer", never],
	],
	[],
	RecordsStore
> = (set, get) => ({
	// Initial state
	recordsByCollection: {},
	selectedRecord: null,
	currentPage: 1,
	pageSize: 10,
	totalCount: 0,
	searchTerm: "",
	filters: {},
	loading: false,
	error: null,

	// Cache management
	collectionCaches: {},

	// Helper function to get or create collection cache
	getOrCreateCache: (collectionName: string): CollectionCache => {
		const { records } = get();
		if (!records.collectionCaches[collectionName]) {
			return {
				records: [],
				currentPage: 1,
				pageSize: 20,
				totalCount: 0,
				searchTerm: "",
				filters: {},
				lastFetch: 0,
				loading: false,
			};
		}
		return records.collectionCaches[collectionName];
	},

	// Actions
	fetchRecords: async (collectionName: string, options?: QueryOptions) => {
		// Initialize cache if it doesn't exist
		set((state) => {
			if (!state.records.collectionCaches[collectionName]) {
				state.records.collectionCaches[collectionName] = {
					records: [],
					currentPage: 1,
					pageSize: 20,
					totalCount: 0,
					searchTerm: "",
					filters: {},
					lastFetch: 0,
					loading: false,
				};
			}
			state.records.collectionCaches[collectionName].loading = true;
			state.records.loading = true;
			state.records.error = null;
		});

		try {
			const cache = get().records.collectionCaches[collectionName];

			// Build query options from cache and provided options
			const queryOptions: QueryOptions = {
				limit: options?.limit || cache.pageSize,
				offset: options?.offset || (cache.currentPage - 1) * cache.pageSize,
				search: options?.search || cache.searchTerm || undefined,
				filter: options?.filter,
				sort: options?.sort,
			};

			// Add filters to query if they exist
			if (Object.keys(cache.filters).length > 0 && !options?.filter) {
				queryOptions.filter = JSON.stringify(cache.filters);
			}

			const response = await recordsApi.list(collectionName, queryOptions);

			set((state) => {
				const cache = state.records.collectionCaches[collectionName];
				cache.records = response.records;
				cache.totalCount = response.pagination.total_count;
				cache.currentPage = response.pagination.current_page;
				cache.pageSize = response.pagination.page_size;
				cache.loading = false;
				cache.lastFetch = Date.now();

				// Update legacy state for backward compatibility
				state.records.recordsByCollection[collectionName] = response.records;
				state.records.loading = false;

				// If this is the current collection being viewed, update global state
				if (state.records.currentPage === cache.currentPage) {
					state.records.totalCount = cache.totalCount;
					state.records.searchTerm = cache.searchTerm;
					state.records.filters = cache.filters;
				}
			});
		} catch (error: any) {
			set((state) => {
				if (state.records.collectionCaches[collectionName]) {
					state.records.collectionCaches[collectionName].loading = false;
				}
				state.records.loading = false;
				state.records.error = error.message || "Failed to fetch records";
			});
		}
	},

	fetchRecord: async (collectionName: string, id: number) => {
		set((state) => {
			state.records.loading = true;
			state.records.error = null;
		});

		try {
			const record = await recordsApi.get(collectionName, id);

			set((state) => {
				state.records.selectedRecord = record;
				state.records.loading = false;

				// Update record in the collection list if it exists
				if (state.records.recordsByCollection[collectionName]) {
					const index = state.records.recordsByCollection[
						collectionName
					].findIndex((r) => r.id === id);
					if (index !== -1) {
						state.records.recordsByCollection[collectionName][index] = record;
					}
				}
			});
		} catch (error: any) {
			set((state) => {
				state.records.loading = false;
				state.records.error = error.message || "Failed to fetch record";
			});
		}
	},

	createRecord: async (collectionName: string, data: CreateRecordRequest) => {
		set((state) => {
			state.records.loading = true;
			state.records.error = null;
		});

		try {
			const record = await recordsApi.create(collectionName, data);

			set((state) => {
				if (!state.records.recordsByCollection[collectionName]) {
					state.records.recordsByCollection[collectionName] = [];
				}
				state.records.recordsByCollection[collectionName].unshift(record);
				state.records.loading = false;
			});

			// Update collection record count
			const { collections } = get();
			collections.fetchRecordCount(collectionName);
		} catch (error: any) {
			set((state) => {
				state.records.loading = false;
				state.records.error = error.message || "Failed to create record";
			});
			throw error;
		}
	},

	updateRecord: async (
		collectionName: string,
		id: number,
		data: UpdateRecordRequest,
	) => {
		set((state) => {
			state.records.loading = true;
			state.records.error = null;
		});

		try {
			const record = await recordsApi.update(collectionName, id, data);

			set((state) => {
				if (state.records.recordsByCollection[collectionName]) {
					const index = state.records.recordsByCollection[
						collectionName
					].findIndex((r) => r.id === id);
					if (index !== -1) {
						state.records.recordsByCollection[collectionName][index] = record;
					}
				}

				if (state.records.selectedRecord?.id === id) {
					state.records.selectedRecord = record;
				}

				state.records.loading = false;
			});
		} catch (error: any) {
			set((state) => {
				state.records.loading = false;
				state.records.error = error.message || "Failed to update record";
			});
			throw error;
		}
	},

	deleteRecord: async (collectionName: string, id: number) => {
		set((state) => {
			state.records.loading = true;
			state.records.error = null;
		});

		try {
			await recordsApi.delete(collectionName, id);

			set((state) => {
				if (state.records.recordsByCollection[collectionName]) {
					state.records.recordsByCollection[collectionName] =
						state.records.recordsByCollection[collectionName].filter(
							(r) => r.id !== id,
						);
				}

				if (state.records.selectedRecord?.id === id) {
					state.records.selectedRecord = null;
				}

				state.records.loading = false;
			});

			// Update collection record count
			const { collections } = get();
			collections.fetchRecordCount(collectionName);
		} catch (error: any) {
			set((state) => {
				state.records.loading = false;
				state.records.error = error.message || "Failed to delete record";
			});
			throw error;
		}
	},

	setSelectedRecord: (record: Record | null) => {
		set((state) => {
			state.records.selectedRecord = record;
		});
	},

	setSearchTerm: (term: string) => {
		set((state) => {
			state.records.searchTerm = term;
		});
	},

	setCurrentPage: (page: number) => {
		set((state) => {
			state.records.currentPage = page;
		});
	},

	setFilters: (filters: { [key: string]: any }) => {
		set((state) => {
			state.records.filters = filters;
		});
	},

	// Collection-specific actions
	setCollectionSearchTerm: (collectionName: string, term: string) => {
		set((state) => {
			if (!state.records.collectionCaches[collectionName]) {
				state.records.collectionCaches[collectionName] = {
					records: [],
					currentPage: 1,
					pageSize: 20,
					totalCount: 0,
					searchTerm: "",
					filters: {},
					lastFetch: 0,
					loading: false,
				};
			}
			state.records.collectionCaches[collectionName].searchTerm = term;
			state.records.collectionCaches[collectionName].currentPage = 1; // Reset to first page
		});
	},

	setCollectionCurrentPage: (collectionName: string, page: number) => {
		set((state) => {
			if (!state.records.collectionCaches[collectionName]) {
				state.records.collectionCaches[collectionName] = {
					records: [],
					currentPage: 1,
					pageSize: 20,
					totalCount: 0,
					searchTerm: "",
					filters: {},
					lastFetch: 0,
					loading: false,
				};
			}
			state.records.collectionCaches[collectionName].currentPage = page;
		});
	},

	setCollectionFilters: (
		collectionName: string,
		filters: { [key: string]: any },
	) => {
		set((state) => {
			if (!state.records.collectionCaches[collectionName]) {
				state.records.collectionCaches[collectionName] = {
					records: [],
					currentPage: 1,
					pageSize: 20,
					totalCount: 0,
					searchTerm: "",
					filters: {},
					lastFetch: 0,
					loading: false,
				};
			}
			state.records.collectionCaches[collectionName].filters = filters;
			state.records.collectionCaches[collectionName].currentPage = 1; // Reset to first page
		});
	},

	setCollectionPageSize: (collectionName: string, pageSize: number) => {
		set((state) => {
			if (!state.records.collectionCaches[collectionName]) {
				state.records.collectionCaches[collectionName] = {
					records: [],
					currentPage: 1,
					pageSize: 20,
					totalCount: 0,
					searchTerm: "",
					filters: {},
					lastFetch: 0,
					loading: false,
				};
			}
			state.records.collectionCaches[collectionName].pageSize = pageSize;
			state.records.collectionCaches[collectionName].currentPage = 1; // Reset to first page
		});
	},

	// Cache management
	getCollectionCache: (collectionName: string) => {
		const { records } = get();
		return records.collectionCaches[collectionName] || null;
	},

	clearCollectionCache: (collectionName: string) => {
		set((state) => {
			delete state.records.collectionCaches[collectionName];
			// Also clear legacy state if it matches
			if (state.records.recordsByCollection[collectionName]) {
				delete state.records.recordsByCollection[collectionName];
			}
		});
	},

	clearAllCaches: () => {
		set((state) => {
			state.records.collectionCaches = {};
			state.records.recordsByCollection = {};
		});
	},
});
