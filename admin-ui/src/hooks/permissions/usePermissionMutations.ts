import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { permissionsApi } from "@/lib/api";
import type { SetCollectionPermissionRequest } from "@/types/api";

// Query keys
const permissionKeys = {
	all: ["permissions"] as const,
	roles: () => [...permissionKeys.all, "roles"] as const,
	userPermissions: () => [...permissionKeys.all, "user-permissions"] as const,
	userPermission: (userId: number, collectionName: string) =>
		[...permissionKeys.userPermissions(), userId, collectionName] as const,
	collectionPermissions: () =>
		[...permissionKeys.all, "collection-permissions"] as const,
	collectionPermission: (roleName: string, collectionName: string) =>
		[
			...permissionKeys.collectionPermissions(),
			roleName,
			collectionName,
		] as const,
};

// Set collection permission
export const useSetCollectionPermission = () => {
	const queryClient = useQueryClient();
	const { toast } = useToast();

	return useMutation({
		mutationFn: (data: SetCollectionPermissionRequest) =>
			permissionsApi.setCollectionPermission(data),
		onSuccess: () => {
			// Invalidate related queries
			queryClient.invalidateQueries({
				queryKey: permissionKeys.collectionPermissions(),
			});
			queryClient.invalidateQueries({
				queryKey: permissionKeys.userPermissions(),
			});

			toast({
				title: "Success",
				description: "Collection permission updated successfully",
				variant: "success",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error?.message || "Failed to update collection permission",
				variant: "destructive",
			});
		},
	});
};

// Set user collection permissions
export const useSetUserCollectionPermissions = () => {
	const queryClient = useQueryClient();
	const { toast } = useToast();

	return useMutation({
		mutationFn: (
			data: SetCollectionPermissionRequest & {
				user_id: number;
				collection_name: string;
			},
		) => permissionsApi.setUserCollectionPermissions(data),
		onSuccess: (_, variables) => {
			// Invalidate related queries
			queryClient.invalidateQueries({
				queryKey: permissionKeys.userPermission(
					variables.user_id,
					variables.collection_name,
				),
			});
			queryClient.invalidateQueries({
				queryKey: permissionKeys.userPermissions(),
			});

			toast({
				title: "Success",
				description: "User permissions updated successfully",
				variant: "default",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error?.message || "Failed to update user permissions",
				variant: "destructive",
			});
		},
	});
};

// Check collection permission
export const useCheckCollectionPermission = () => {
	const { toast } = useToast();

	return useMutation({
		mutationFn: ({
			userId,
			collectionName,
			permission,
		}: {
			userId: number;
			collectionName: string;
			permission:
				| "can_create"
				| "can_read"
				| "can_update"
				| "can_delete"
				| "can_list";
		}) =>
			permissionsApi.checkCollectionPermission(
				userId,
				collectionName,
				permission,
			),
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error?.message || "Failed to check permission",
				variant: "destructive",
			});
		},
	});
};
