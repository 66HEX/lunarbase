// Permissions Store Slice
import type { StateCreator } from "zustand";
import { permissionsApi, rolesApi } from "@/lib/api";
import type {
	CollectionPermission,
	CreateRoleRequest,
	PermissionResult,
	SetCollectionPermissionRequest,
	SetUserCollectionPermissionRequest,
	UpdateRoleRequest,
	UserCollectionPermission,
} from "@/types/api";
import type { PermissionsStore, RootStore } from "@/types/store.types";

export const createPermissionsSlice: StateCreator<
	RootStore,
	[
		["zustand/devtools", never],
		["zustand/subscribeWithSelector", never],
		["zustand/immer", never],
	],
	[],
	PermissionsStore
> = (set, get) => ({
	// Initial state
	roles: [],
	rolePermissions: {},
	userPermissions: {},
	collectionPermissions: {},
	userCollectionPermissions: {},
	loading: false,
	error: null,

	// Role Actions
	fetchRoles: async () => {
		set((state) => {
			state.permissions.loading = true;
			state.permissions.error = null;
		});

		try {
			const roles = await rolesApi.list();

			set((state) => {
				state.permissions.roles = roles;
				state.permissions.loading = false;
			});
		} catch (error: any) {
			set((state) => {
				state.permissions.loading = false;
				state.permissions.error = error.message || "Failed to fetch roles";
			});
		}
	},

	createRole: async (data: CreateRoleRequest) => {
		set((state) => {
			state.permissions.loading = true;
			state.permissions.error = null;
		});

		try {
			const role = await rolesApi.create(data);

			set((state) => {
				state.permissions.roles.push(role);
				state.permissions.loading = false;
			});
		} catch (error: any) {
			set((state) => {
				state.permissions.loading = false;
				state.permissions.error = error.message || "Failed to create role";
			});
			throw error;
		}
	},

	updateRole: async (roleName: string, data: UpdateRoleRequest) => {
		set((state) => {
			state.permissions.loading = true;
			state.permissions.error = null;
		});

		try {
			const role = await rolesApi.update(roleName, data);

			set((state) => {
				const index = state.permissions.roles.findIndex(
					(r) => r.name === roleName,
				);
				if (index !== -1) {
					state.permissions.roles[index] = role;
				}
				state.permissions.loading = false;
			});
		} catch (error: any) {
			set((state) => {
				state.permissions.loading = false;
				state.permissions.error = error.message || "Failed to update role";
			});
			throw error;
		}
	},

	deleteRole: async (roleName: string) => {
		set((state) => {
			state.permissions.loading = true;
			state.permissions.error = null;
		});

		try {
			await rolesApi.delete(roleName);

			set((state) => {
				state.permissions.roles = state.permissions.roles.filter(
					(r) => r.name !== roleName,
				);

				// Clean up related permissions
				Object.keys(state.permissions.collectionPermissions).forEach(
					(collectionName) => {
						delete state.permissions.collectionPermissions[collectionName][
							roleName
						];
					},
				);

				state.permissions.loading = false;
			});
		} catch (error: any) {
			set((state) => {
				state.permissions.loading = false;
				state.permissions.error = error.message || "Failed to delete role";
			});
			throw error;
		}
	},

	// Collection Permission Actions
	fetchRolePermissions: async (roleName: string, collectionName: string) => {
		set((state) => {
			state.permissions.loading = true;
			state.permissions.error = null;
		});

		try {
			const permissions = await permissionsApi.getCollectionPermissions(
				roleName,
				collectionName,
			);

			set((state) => {
				if (!state.permissions.collectionPermissions[collectionName]) {
					state.permissions.collectionPermissions[collectionName] = {};
				}
				state.permissions.collectionPermissions[collectionName][roleName] =
					permissions;
				state.permissions.loading = false;
			});
		} catch (error: any) {
			set((state) => {
				state.permissions.loading = false;
				state.permissions.error =
					error.message || "Failed to fetch role permissions";
			});
		}
	},

	setRolePermissions: async (data: SetCollectionPermissionRequest) => {
		set((state) => {
			state.permissions.loading = true;
			state.permissions.error = null;
		});

		try {
			await permissionsApi.setCollectionPermission(data);

			// Optimistically update the local state
			set((state) => {
				if (!state.permissions.collectionPermissions[data.collection_name]) {
					state.permissions.collectionPermissions[data.collection_name] = {};
				}

				// Find the role to get its ID
				const role = state.permissions.roles.find(
					(r) => r.name === data.role_name,
				);
				if (role) {
					state.permissions.collectionPermissions[data.collection_name][
						data.role_name
					] = {
						id: 0, // Will be updated on next fetch
						role_id: role.id,
						collection_name: data.collection_name,
						can_create: data.can_create,
						can_read: data.can_read,
						can_update: data.can_update,
						can_delete: data.can_delete,
						can_list: data.can_list,
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					};
				}

				state.permissions.loading = false;
			});
		} catch (error: any) {
			set((state) => {
				state.permissions.loading = false;
				state.permissions.error =
					error.message || "Failed to set role permissions";
			});
			throw error;
		}
	},

	// User Permission Actions
	fetchUserPermissions: async (userId: number, collectionName: string) => {
		set((state) => {
			state.permissions.loading = true;
			state.permissions.error = null;
		});

		try {
			const permissions = await permissionsApi.getUserCollectionPermissions(
				userId,
				collectionName,
			);

			set((state) => {
				if (!state.permissions.userCollectionPermissions[collectionName]) {
					state.permissions.userCollectionPermissions[collectionName] = {};
				}
				state.permissions.userCollectionPermissions[collectionName][userId] =
					permissions;
				state.permissions.loading = false;
			});
		} catch (error: any) {
			set((state) => {
				state.permissions.loading = false;
				state.permissions.error =
					error.message || "Failed to fetch user permissions";
			});
		}
	},

	setUserPermissions: async (data: SetUserCollectionPermissionRequest) => {
		set((state) => {
			state.permissions.loading = true;
			state.permissions.error = null;
		});

		try {
			await permissionsApi.setUserCollectionPermissions(data);

			// Optimistically update the local state
			set((state) => {
				if (
					!state.permissions.userCollectionPermissions[data.collection_name]
				) {
					state.permissions.userCollectionPermissions[data.collection_name] =
						{};
				}

				state.permissions.userCollectionPermissions[data.collection_name][
					data.user_id
				] = {
					id: 0, // Will be updated on next fetch
					user_id: data.user_id,
					collection_id: 0, // Will be updated on next fetch
					can_create: data.can_create,
					can_read: data.can_read,
					can_update: data.can_update,
					can_delete: data.can_delete,
					can_list: data.can_list,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				};

				state.permissions.loading = false;
			});
		} catch (error: any) {
			set((state) => {
				state.permissions.loading = false;
				state.permissions.error =
					error.message || "Failed to set user permissions";
			});
			throw error;
		}
	},

	// Utility Actions
	checkUserPermission: async (
		userId: number,
		collectionName: string,
		permission:
			| "can_create"
			| "can_read"
			| "can_update"
			| "can_delete"
			| "can_list",
	): Promise<PermissionResult> => {
		try {
			return await permissionsApi.checkCollectionPermission(
				userId,
				collectionName,
				permission,
			);
		} catch (error: any) {
			console.error("Failed to check user permission:", error);
			return {
				has_permission: false,
				reason: error.message || "Permission check failed",
			};
		}
	},

	getUserAccessibleCollections: async (userId: number): Promise<string[]> => {
		try {
			return await permissionsApi.getUserAccessibleCollections(userId);
		} catch (error: any) {
			console.error("Failed to get accessible collections:", error);
			return [];
		}
	},

	// Bulk operations for better performance
	fetchAllRolePermissionsForCollection: async (collectionName: string) => {
		set((state) => {
			state.permissions.loading = true;
			state.permissions.error = null;
		});

		try {
			const { roles } = get().permissions;
			const permissionsPromises = roles.map(async (role) => {
				try {
					const permissions = await permissionsApi.getCollectionPermissions(
						role.name,
						collectionName,
					);
					return { roleName: role.name, permissions };
				} catch (error) {
					// Return default permissions if not found
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
						} as CollectionPermission,
					};
				}
			});

			const results = await Promise.all(permissionsPromises);

			set((state) => {
				if (!state.permissions.collectionPermissions[collectionName]) {
					state.permissions.collectionPermissions[collectionName] = {};
				}

				results.forEach(({ roleName, permissions }) => {
					state.permissions.collectionPermissions[collectionName][roleName] =
						permissions;
				});

				state.permissions.loading = false;
			});
		} catch (error: any) {
			set((state) => {
				state.permissions.loading = false;
				state.permissions.error =
					error.message || "Failed to fetch collection permissions";
			});
		}
	},

	// Clear cached permissions
	clearPermissionsCache: () => {
		set((state) => {
			state.permissions.collectionPermissions = {};
			state.permissions.userCollectionPermissions = {};
			state.permissions.rolePermissions = {};
			state.permissions.userPermissions = {};
		});
	},

	// Get permissions from cache
	getRolePermissionsFromCache: (
		roleName: string,
		collectionName: string,
	): CollectionPermission | null => {
		const state = get().permissions;
		return state.collectionPermissions[collectionName]?.[roleName] || null;
	},

	getUserPermissionsFromCache: (
		userId: number,
		collectionName: string,
	): UserCollectionPermission | null => {
		const state = get().permissions;
		return state.userCollectionPermissions[collectionName]?.[userId] || null;
	},
});
