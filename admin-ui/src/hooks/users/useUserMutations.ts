import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { usersApi } from "@/lib/api";
import type { CreateUserRequest, UpdateUserRequest, User } from "@/types/api";
import { userKeys } from "./useUsers";

// Create user mutation
export const useCreateUser = () => {
	const queryClient = useQueryClient();
	const { toast } = useToast();

	return useMutation({
		mutationFn: (data: CreateUserRequest) => usersApi.create(data),
		onSuccess: (newUser: User) => {
			// Invalidate and refetch users list
			queryClient.invalidateQueries({ queryKey: userKeys.all });

			toast({
				title: "User created",
				description: `User ${newUser.email} has been created successfully.`,
				variant: "success",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Failed to create user",
				description: error?.message || "An unexpected error occurred.",
				variant: "destructive",
			});
		},
	});
};

// Update user mutation
export const useUpdateUser = () => {
	const queryClient = useQueryClient();
	const { toast } = useToast();

	return useMutation({
		mutationFn: ({ id, data }: { id: number; data: UpdateUserRequest }) =>
			usersApi.update(id, data),
		onSuccess: (updatedUser: User) => {
			// Update the user in the cache
			queryClient.setQueryData(userKeys.detail(updatedUser.id), updatedUser);

			// Invalidate users list to ensure consistency
			queryClient.invalidateQueries({ queryKey: userKeys.lists() });

			toast({
				title: "User updated",
				description: `User ${updatedUser.email} has been updated successfully.`,
				variant: "success",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Failed to update user",
				description: error?.message || "An unexpected error occurred.",
				variant: "destructive",
			});
		},
	});
};

// Delete user mutation
export const useDeleteUser = () => {
	const queryClient = useQueryClient();
	const { toast } = useToast();

	return useMutation({
		mutationFn: (id: number) => usersApi.delete(id),
		onSuccess: (_, deletedUserId) => {
			// Remove the user from all relevant queries
			queryClient.removeQueries({ queryKey: userKeys.detail(deletedUserId) });

			// Invalidate users list
			queryClient.invalidateQueries({ queryKey: userKeys.lists() });

			toast({
				title: "User deleted",
				description: "User has been deleted successfully.",
				variant: "success",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Failed to delete user",
				description: error?.message || "An unexpected error occurred.",
				variant: "destructive",
			});
		},
	});
};

// Unlock user mutation
export const useUnlockUser = () => {
	const queryClient = useQueryClient();
	const { toast } = useToast();

	return useMutation({
		mutationFn: (id: number) => usersApi.unlock(id),
		onSuccess: (unlockedUser: User) => {
			// Update the user in the cache
			queryClient.setQueryData(userKeys.detail(unlockedUser.id), unlockedUser);

			// Invalidate users list to ensure consistency
			queryClient.invalidateQueries({ queryKey: userKeys.lists() });

			toast({
				title: "User unlocked",
				description: `User ${unlockedUser.email} has been unlocked successfully.`,
				variant: "success",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Failed to unlock user",
				description: error?.message || "An unexpected error occurred.",
				variant: "destructive",
			});
		},
	});
};
