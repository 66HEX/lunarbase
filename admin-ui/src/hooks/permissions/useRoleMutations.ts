import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { rolesApi } from "@/lib/api";
import type { CreateRoleRequest, Role, UpdateRoleRequest } from "@/types/api";
import { permissionKeys } from "./usePermissions";

export const useCreateRole = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: CreateRoleRequest) => rolesApi.create(data),
		onSuccess: (newRole: Role) => {
			queryClient.invalidateQueries({ queryKey: permissionKeys.roles() });

			toast({
				title: "Role created",
				description: `Role ${newRole.name} has been created successfully.`,
				variant: "success",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Failed to create role",
				description: error?.message || "An unexpected error occurred.",
				variant: "destructive",
			});
		},
	});
};

export const useUpdateRole = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			roleName,
			data,
		}: {
			roleName: string;
			data: UpdateRoleRequest;
		}) => rolesApi.update(roleName, data),
		onSuccess: (updatedRole: Role) => {
			queryClient.invalidateQueries({ queryKey: permissionKeys.roles() });

			queryClient.invalidateQueries({
				queryKey: permissionKeys.collectionPermissions(),
			});

			toast({
				title: "Role updated",
				description: `Role ${updatedRole.name} has been updated successfully.`,
				variant: "success",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Failed to update role",
				description: error?.message || "An unexpected error occurred.",
				variant: "destructive",
			});
		},
	});
};

export const useDeleteRole = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (roleName: string) => rolesApi.delete(roleName),
		onSuccess: (_, deletedRoleName) => {
			queryClient.invalidateQueries({ queryKey: permissionKeys.roles() });

			queryClient.invalidateQueries({
				queryKey: permissionKeys.collectionPermissions(),
			});
			queryClient.invalidateQueries({
				queryKey: permissionKeys.userPermissions(),
			});

			toast({
				title: "Role deleted",
				description: `Role ${deletedRoleName} has been deleted successfully.`,
				variant: "success",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Failed to delete role",
				description: error?.message || "An unexpected error occurred.",
				variant: "destructive",
			});
		},
	});
};
