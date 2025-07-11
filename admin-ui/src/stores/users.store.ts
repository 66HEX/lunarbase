// Users Store Slice
import type { StateCreator } from "zustand";
import { usersApi } from "@/lib/api";
import type { User } from "@/types/api";
import type { RootStore, UsersStore } from "@/types/store.types";

export const createUsersSlice: StateCreator<
	RootStore,
	[
		["zustand/devtools", never],
		["zustand/subscribeWithSelector", never],
		["zustand/immer", never],
	],
	[],
	UsersStore
> = (set) => ({
	// Initial state
	users: [],
	selectedUser: null,
	currentPage: 1,
	pageSize: 20,
	totalCount: 0,
	loading: false,
	error: null,

	// Actions
	fetchUsers: async (options?: any) => {
		set((state) => {
			state.users.loading = true;
			state.users.error = null;
		});

		try {
			const response = await usersApi.list(options);
			const { users, pagination } = response;

			set((state) => {
				state.users.users = users;
				state.users.totalCount = pagination.total_count;
				state.users.currentPage = pagination.current_page;
				state.users.pageSize = pagination.page_size;
				state.users.loading = false;
			});
		} catch (error: any) {
			set((state) => {
				state.users.loading = false;
				state.users.error = error.message || "Failed to fetch users";
			});
		}
	},

	fetchUser: async (id: number) => {
		set((state) => {
			state.users.loading = true;
			state.users.error = null;
		});

		try {
			const user = await usersApi.get(id);

			set((state) => {
				state.users.selectedUser = user;
				state.users.loading = false;

				// Update user in the list if it exists
				const index = state.users.users.findIndex((u) => u.id === id);
				if (index !== -1) {
					state.users.users[index] = user;
				}
			});
		} catch (error: any) {
			set((state) => {
				state.users.loading = false;
				state.users.error = error.message || "Failed to fetch user";
			});
		}
	},

	// Note: Create, update, delete operations are not available in the current API
	// These would need to be implemented on the backend first
	createUser: async () => {
		throw new Error("User creation not implemented yet");
	},

	updateUser: async () => {
		throw new Error("User update not implemented yet");
	},

	deleteUser: async () => {
		throw new Error("User deletion not implemented yet");
	},

	setSelectedUser: (user: User | null) => {
		set((state) => {
			state.users.selectedUser = user;
		});
	},

	setCurrentPage: (page: number) => {
		set((state) => {
			state.users.currentPage = page;
		});
	},
});
