// Users Store with Persist Middleware
import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { usersApi } from "@/lib/api";
import type {
	CreateUserRequest,
	UpdateUserRequest,
	User,
	UsersListParams,
} from "@/types/api";

interface UsersState {
	// State
	users: User[];
	selectedUser: User | null;
	currentPage: number;
	pageSize: number;
	totalCount: number;
	searchTerm: string;
	loading: boolean;
	error: string | null;
	lastFetched: number | null;

	// Cache settings
	cacheTimeout: number; // 5 minutes
}

interface UsersActions {
	// Actions
	fetchUsers: (params?: UsersListParams, force?: boolean) => Promise<void>;
	fetchUser: (id: number) => Promise<void>;
	createUser: (data: CreateUserRequest) => Promise<void>;
	updateUser: (id: number, data: UpdateUserRequest) => Promise<void>;
	deleteUser: (id: number) => Promise<void>;
	unlockUser: (id: number) => Promise<void>;
	toggleUserStatus: (id: number) => Promise<void>;
	setSelectedUser: (user: User | null) => void;
	setCurrentPage: (page: number) => void;
	setSearchTerm: (term: string) => void;
	clearError: () => void;
	invalidateCache: () => void;
}

type UsersStore = UsersState & UsersActions;

export const useUsersStore = create<UsersStore>()(
	devtools(
		immer(
			persist(
				(set, get) => ({
					// Initial state
					users: [],
					selectedUser: null,
					currentPage: 1,
					pageSize: 10,
					totalCount: 0,
					searchTerm: "",
					loading: false,
					error: null,
					lastFetched: null,
					cacheTimeout: 5 * 60 * 1000, // 5 minutes

					// Actions
					fetchUsers: async (params?: UsersListParams, force = false) => {
						const state = get();
						const now = Date.now();

						// Check cache validity
						if (!force && state.lastFetched && state.users.length > 0) {
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
							// Always get fresh state for current parameters
							const currentState = get();
							const requestParams = params || {
								limit: currentState.pageSize,
								offset: (currentState.currentPage - 1) * currentState.pageSize,
								sort: "created_at",
								filter: currentState.searchTerm
									? `email:like:%${currentState.searchTerm}%`
									: undefined,
							};

							const data = await usersApi.list(requestParams);

							// Backend returns PaginatedUsersResponse structure
							if (!data || !data.users || !data.pagination) {
								throw new Error("Unexpected response format");
							}

							set((state) => {
								state.users = data.users;
								state.totalCount = data.pagination.total_count;
								state.currentPage =
									data.pagination.current_page || state.currentPage;
								state.pageSize = data.pagination.page_size || state.pageSize;
								state.loading = false;
								state.lastFetched = now;
							});
						} catch (error: any) {
							set((state) => {
								state.loading = false;
								state.error = error.message || "Failed to fetch users";
							});
						}
					},

					fetchUser: async (id: number) => {
						set((state) => {
							state.loading = true;
							state.error = null;
						});

						try {
							const user = await usersApi.get(id);

							set((state) => {
								state.selectedUser = user as any;
								state.loading = false;

								// Update user in the list if it exists
								const index = state.users.findIndex((u) => u.id === id);
								if (index !== -1) {
									state.users[index] = user as any;
								}
							});
						} catch (error: any) {
							set((state) => {
								state.loading = false;
								state.error = error.message || "Failed to fetch user";
							});
						}
					},

					createUser: async (data: CreateUserRequest) => {
						set((state) => {
							state.loading = true;
							state.error = null;
						});

						try {
							const newUser = await usersApi.create(data);

							set((state) => {
								state.users.unshift(newUser as any);
								state.totalCount = state.totalCount + 1;
								state.loading = false;
								state.lastFetched = Date.now();
							});
						} catch (error: any) {
							set((state) => {
								state.loading = false;
								state.error = error.message || "Failed to create user";
							});
							throw error;
						}
					},

					updateUser: async (id: number, data: UpdateUserRequest) => {
						set((state) => {
							state.loading = true;
							state.error = null;
						});

						// Store original user for rollback
						const originalUser = get().users.find((u) => u.id === id);
						const originalSelectedUser = get().selectedUser;

						// Optimistic update
						set((state) => {
							const index = state.users.findIndex((u) => u.id === id);
							if (index !== -1) {
								state.users[index] = { ...state.users[index], ...data } as any;
							}

							if (state.selectedUser?.id === id) {
								state.selectedUser = { ...state.selectedUser, ...data } as any;
							}
						});

						try {
							const updatedUser = await usersApi.update(id, data);

							set((state) => {
								const index = state.users.findIndex((u) => u.id === id);
								if (index !== -1) {
									state.users[index] = updatedUser as any;
								}

								if (state.selectedUser?.id === id) {
									state.selectedUser = updatedUser as any;
								}

								state.loading = false;
								state.lastFetched = Date.now();
							});
						} catch (error: any) {
							// Rollback optimistic update
							set((state) => {
								if (originalUser) {
									const index = state.users.findIndex((u) => u.id === id);
									if (index !== -1) {
										state.users[index] = originalUser as any;
									}
								}

								if (originalSelectedUser?.id === id) {
									state.selectedUser = originalSelectedUser;
								}

								state.loading = false;
								state.error = error.message || "Failed to update user";
							});
							throw error;
						}
					},

					deleteUser: async (id: number) => {
						set((state) => {
							state.loading = true;
							state.error = null;
						});

						// Store original data for rollback
						const originalUsers = get().users;
						const originalSelectedUser = get().selectedUser;
						const originalTotalCount = get().totalCount;

						// Optimistic update
						set((state) => {
							state.users = state.users.filter((u) => u.id !== id);
							state.totalCount = Math.max(0, state.totalCount - 1);

							if (state.selectedUser?.id === id) {
								state.selectedUser = null;
							}
						});

						try {
							await usersApi.delete(id);

							set((state) => {
								state.loading = false;
							});
						} catch (error: any) {
							// Rollback optimistic update
							set((state) => {
								state.users.length = 0;
								state.users.push(...originalUsers);
								state.totalCount = originalTotalCount;
								state.selectedUser = originalSelectedUser;
								state.loading = false;
								state.error = error.message || "Failed to delete user";
							});
							throw error;
						}
					},

					unlockUser: async (id: number) => {
						set((state) => {
							state.loading = true;
							state.error = null;
						});

						// Store original user for rollback
						const originalUser = get().users.find((u) => u.id === id);
						const originalSelectedUser = get().selectedUser;

						// Optimistic update - remove locked_until
						set((state) => {
							const index = state.users.findIndex((u) => u.id === id);
							if (index !== -1) {
								state.users[index] = {
									...state.users[index],
									locked_until: null,
								} as any;
							}

							if (state.selectedUser?.id === id) {
								state.selectedUser = {
									...state.selectedUser,
									locked_until: null,
								} as any;
							}
						});

						try {
							const unlockedUser = await usersApi.unlock(id);

							set((state) => {
								const index = state.users.findIndex((u) => u.id === id);
								if (index !== -1) {
									state.users[index] = unlockedUser as any;
								}

								if (state.selectedUser?.id === id) {
									state.selectedUser = unlockedUser as any;
								}

								state.loading = false;
								state.lastFetched = Date.now();
							});
						} catch (error: any) {
							// Rollback optimistic update
							set((state) => {
								if (originalUser) {
									const index = state.users.findIndex((u) => u.id === id);
									if (index !== -1) {
										state.users[index] = originalUser as any;
									}
								}

								if (originalSelectedUser?.id === id) {
									state.selectedUser = originalSelectedUser;
								}

								state.loading = false;
								state.error = error.message || "Failed to unlock user";
							});
							throw error;
						}
					},

					toggleUserStatus: async (id: number) => {
						const user = get().users.find((u) => u.id === id);
						if (!user) return;

						set((state) => {
							state.loading = true;
							state.error = null;
						});

						// Store original user for rollback
						const originalUser = { ...user };

						// Optimistic update
						set((state) => {
							const index = state.users.findIndex((u) => u.id === id);
							if (index !== -1) {
								// Toggle status (this would need to be implemented in the backend)
								// For now, we'll just update locally
								state.users[index] = {
									...state.users[index],
									// Add status field if it doesn't exist
								};
							}
						});

						try {
							// Note: This would need to be implemented in the backend
							// await usersApi.updateStatus(id, newStatus);

							// For now, we'll simulate the update
							await new Promise((resolve) => setTimeout(resolve, 500));

							set((state) => {
								state.loading = false;
							});
						} catch (error: any) {
							// Rollback optimistic update
							set((state) => {
								const index = state.users.findIndex((u) => u.id === id);
								if (index !== -1) {
									state.users[index] = originalUser as any;
								}
								state.loading = false;
								state.error = error.message || "Failed to update user status";
							});
							throw error;
						}
					},

					setSelectedUser: (user: User | null) => {
						set((state) => {
							state.selectedUser = user;
						});
					},

					setCurrentPage: (page: number) => {
						set((state) => {
							state.currentPage = page;
						});
					},

					setSearchTerm: (term: string) => {
						set((state) => {
							state.searchTerm = term;
							// Reset to first page when search term changes
							state.currentPage = 1;
						});
					},

					clearError: () => {
						set((state) => {
							state.error = null;
						});
					},

					invalidateCache: () => {
						set((state) => {
							state.lastFetched = null;
						});
					},
				}),
				{
					name: "lunarbase-users-storage",
					storage: createJSONStorage(() => localStorage),
					partialize: (state) => ({
						users: state.users,
						currentPage: state.currentPage,
						pageSize: state.pageSize,
						totalCount: state.totalCount,
						searchTerm: state.searchTerm,
						lastFetched: state.lastFetched,
					}),
				},
			),
		),
		{
			name: "users-store",
		},
	),
);
