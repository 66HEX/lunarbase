import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { rolesApi } from "@/lib/api";
import type { CreateRoleRequest, Role, UpdateRoleRequest } from "@/types/api";
import { permissionKeys } from "./usePermissions";

// Create role mutation
export const useCreateRole = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: CreateRoleRequest) => rolesApi.create(data),
		onSuccess: (newRole: Role) => {
			// Invalidate and refetch roles list
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

// Update role mutation
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
			// Invalidate roles list to ensure consistency
			queryClient.invalidateQueries({ queryKey: permissionKeys.roles() });

			// Also invalidate any collection permissions that might be affected
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

// Delete role mutation
export const useDeleteRole = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (roleName: string) => rolesApi.delete(roleName),
		onSuccess: (_, deletedRoleName) => {
			// Invalidate roles list
			queryClient.invalidateQueries({ queryKey: permissionKeys.roles() });

			// Invalidate all collection permissions as they might be affected
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
