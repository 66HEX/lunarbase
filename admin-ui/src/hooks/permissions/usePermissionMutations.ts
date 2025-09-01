import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { permissionsApi } from "@/lib/api";
import type { SetCollectionPermissionRequest } from "@/types/api";

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

export const useSetCollectionPermission = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: SetCollectionPermissionRequest) =>
			permissionsApi.setCollectionPermission(data),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: [
					...permissionKeys.collectionPermissions(),
					"all",
					variables.collection_name,
				],
			});
			queryClient.invalidateQueries({
				queryKey: [
					...permissionKeys.collectionPermissions(),
					variables.role_name,
					variables.collection_name,
				],
			});
			queryClient.invalidateQueries({
				queryKey: permissionKeys.roles(),
			});

			toast({
				title: "Success",
				description: "Collection permission updated successfully",
				variant: "success",
				position: "bottom-right",
				duration: 3000,
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error?.message || "Failed to update collection permission",
				variant: "destructive",
				position: "bottom-right",
				duration: 3000,
			});
		},
	});
};

export const useSetUserCollectionPermissions = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (
			data: SetCollectionPermissionRequest & {
				user_id: number;
				collection_name: string;
			},
		) => permissionsApi.setUserCollectionPermissions(data),
		onSuccess: (_, variables) => {
			// Invalidate specific user permission
			queryClient.invalidateQueries({
				queryKey: permissionKeys.userPermission(
					variables.user_id,
					variables.collection_name,
				),
			});
			// Invalidate all user permissions
			queryClient.invalidateQueries({
				queryKey: permissionKeys.userPermissions(),
			});
			// Invalidate collection permissions for this collection
			queryClient.invalidateQueries({
				queryKey: [
					...permissionKeys.collectionPermissions(),
					"all",
					variables.collection_name,
				],
			});

			toast({
				title: "Success",
				description: "User permissions updated successfully",
				variant: "success",
				position: "bottom-right",
				duration: 3000,
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Error",
				description: error?.message || "Failed to update user permissions",
				variant: "destructive",
				position: "bottom-right",
				duration: 3000,
			});
		},
	});
};

export const useCheckCollectionPermission = () => {
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
