import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { collectionsApi, permissionsApi } from "@/lib/api";
import type {
	BasePermissions,
	Collection,
	CollectionPermissions,
	CreateCollectionRequest,
	SetCollectionPermissionRequest,
	UpdateCollectionRequest,
} from "@/types/api";

/**
 * Custom hook for creating a new collection
 * @returns Mutation object for creating collections
 */
export const useCreateCollection = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: CreateCollectionRequest) => {
			return await collectionsApi.create(data);
		},
		onSuccess: (newCollection: Collection) => {
			queryClient.invalidateQueries({ queryKey: ["collections"] });

			queryClient.setQueryData(
				["collections"],
				(
					old:
						| {
								collections: Collection[];
								recordCounts: Record<string, number>;
						  }
						| undefined,
				) => {
					if (!old) return old;
					return {
						collections: [...old.collections, newCollection],
						recordCounts: {
							...old.recordCounts,
							[newCollection.name]: 0,
						},
					};
				},
			);

			toast({
				title: "Success",
				description: `Collection "${newCollection.name}" created successfully`,
				variant: "success",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error?.message || "Failed to create collection",
				variant: "destructive",
			});
		},
	});
};

/**
 * Custom hook for updating an existing collection
 * @returns Mutation object for updating collections
 */
export const useUpdateCollection = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			name,
			data,
		}: {
			name: string;
			data: UpdateCollectionRequest;
		}) => {
			return await collectionsApi.update(name, data);
		},
		onSuccess: (updatedCollection: Collection) => {
			queryClient.invalidateQueries({ queryKey: ["collections"] });

			queryClient.setQueryData(
				["collections", updatedCollection.name],
				updatedCollection,
			);

			queryClient.setQueryData(
				["collections"],
				(
					old:
						| {
								collections: Collection[];
								recordCounts: Record<string, number>;
						  }
						| undefined,
				) => {
					if (!old) return old;
					return {
						...old,
						collections: old.collections.map((collection) =>
							collection.name === updatedCollection.name
								? updatedCollection
								: collection,
						),
					};
				},
			);

			toast({
				title: "Success",
				description: `Collection "${updatedCollection.name}" updated successfully`,
				variant: "success",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error?.message || "Failed to update collection",
				variant: "destructive",
			});
		},
	});
};

/**
 * Custom hook for deleting a collection
 * @returns Mutation object for deleting collections
 */
export const useDeleteCollection = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (name: string) => {
			await collectionsApi.delete(name);
			return name;
		},
		onSuccess: (deletedName: string) => {
			queryClient.invalidateQueries({ queryKey: ["collections"] });

			queryClient.removeQueries({ queryKey: ["collections", deletedName] });

			queryClient.setQueryData(
				["collections"],
				(
					old:
						| {
								collections: Collection[];
								recordCounts: Record<string, number>;
						  }
						| undefined,
				) => {
					if (!old) return old;
					const remainingCounts = { ...old.recordCounts };
					delete remainingCounts[deletedName];
					return {
						collections: old.collections.filter(
							(collection) => collection.name !== deletedName,
						),
						recordCounts: remainingCounts,
					};
				},
			);

			queryClient.invalidateQueries({ queryKey: ["records", deletedName] });
			queryClient.invalidateQueries({ queryKey: ["permissions"] });

			toast({
				title: "Success",
				description: `Collection "${deletedName}" deleted successfully`,
				variant: "success",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error?.message || "Failed to delete collection",
				variant: "destructive",
			});
		},
	});
};

/**
 * Custom hook for saving collection permissions
 * @returns Mutation object for saving collection permissions
 */
export const useSaveCollectionPermissions = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			collectionName,
			permissions,
		}: {
			collectionName: string;
			permissions: CollectionPermissions;
		}) => {
			const promises: Promise<void>[] = [];

			for (const [roleName, rolePerms] of Object.entries(
				permissions.role_permissions,
			)) {
				const typedRolePerms = rolePerms as BasePermissions;
				const rolePermissionRequest: SetCollectionPermissionRequest = {
					role_name: roleName,
					collection_name: collectionName,
					can_create: typedRolePerms.can_create,
					can_read: typedRolePerms.can_read,
					can_update: typedRolePerms.can_update,
					can_delete: typedRolePerms.can_delete,
					can_list: typedRolePerms.can_list,
				};
				promises.push(
					permissionsApi.setCollectionPermission(rolePermissionRequest),
				);
			}

			for (const [userId, userPerms] of Object.entries(
				permissions.user_permissions,
			)) {
				const typedUserPerms = userPerms as {
					can_create: boolean | null;
					can_read: boolean | null;
					can_update: boolean | null;
					can_delete: boolean | null;
					can_list: boolean | null;
				};
				const userPermissionRequest = {
					user_id: parseInt(userId),
					collection_name: collectionName,
					can_create: typedUserPerms.can_create,
					can_read: typedUserPerms.can_read,
					can_update: typedUserPerms.can_update,
					can_delete: typedUserPerms.can_delete,
					can_list: typedUserPerms.can_list,
				};
				promises.push(
					permissionsApi.setUserCollectionPermissions(userPermissionRequest),
				);
			}

			await Promise.all(promises);
			return { collectionName, permissions };
		},
		onSuccess: ({ collectionName }) => {
			queryClient.invalidateQueries({ queryKey: ["permissions"] });
			queryClient.invalidateQueries({
				queryKey: ["collections", collectionName],
			});

			toast({
				title: "Success",
				description: `Permissions for "${collectionName}" saved successfully`,
				variant: "success",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error?.message || "Failed to save permissions",
				variant: "destructive",
			});
		},
	});
};
