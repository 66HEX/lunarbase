import { useQuery } from "@tanstack/react-query";
import { permissionsApi, rolesApi } from "@/lib/api";

// Query keys for permissions
export const permissionKeys = {
	all: ["permissions"] as const,
	roles: () => [...permissionKeys.all, "roles"] as const,
	userPermissions: () => [...permissionKeys.all, "user-permissions"] as const,
	userPermission: (userId: number, collectionName: string) =>
		[...permissionKeys.userPermissions(), userId, collectionName] as const,
	collectionPermissions: () =>
		[...permissionKeys.all, "collection-permissions"] as const,
	collectionPermission: (collectionName: string) =>
		[...permissionKeys.collectionPermissions(), collectionName] as const,
};

// Get all roles
export const useRoles = () => {
	return useQuery({
		queryKey: permissionKeys.roles(),
		queryFn: () => rolesApi.list(),
		staleTime: 10 * 60 * 1000, // 10 minutes
		gcTime: 30 * 60 * 1000, // 30 minutes
	});
};

// Get user collection permissions
export const useUserCollectionPermissions = (
	userId: number,
	collectionName: string,
) => {
	return useQuery({
		queryKey: permissionKeys.userPermission(userId, collectionName),
		queryFn: () =>
			permissionsApi.getUserCollectionPermissions(userId, collectionName),
		enabled: !!userId && !!collectionName,
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
	});
};

// Get role collection permissions
export const useRoleCollectionPermissions = (
	roleName: string,
	collectionName: string,
) => {
	return useQuery({
		queryKey: [
			...permissionKeys.collectionPermissions(),
			roleName,
			collectionName,
		],
		queryFn: () =>
			permissionsApi.getCollectionPermissions(roleName, collectionName),
		enabled: !!roleName && !!collectionName,
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
	});
};

// Get all role collection permissions for a collection
export const useAllRoleCollectionPermissions = (
	collectionName: string,
	options?: { enabled?: boolean },
) => {
	const { data: rolesData } = useRoles();
	const roles = rolesData || [];

	return useQuery({
		queryKey: [
			...permissionKeys.collectionPermissions(),
			"all",
			collectionName,
		],
		queryFn: async () => {
			const permissionsPromises = roles.map(async (role: any) => {
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
						},
					};
				}
			});

			const results = await Promise.all(permissionsPromises);
			const permissionsMap: Record<string, any> = {};

			results.forEach(({ roleName, permissions }) => {
				permissionsMap[roleName] = permissions;
			});

			return permissionsMap;
		},
		enabled: !!collectionName && roles.length > 0 && options?.enabled !== false,
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
	});
};
