import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { usersApi } from "@/lib/api";
import type { CreateUserRequest, UpdateUserRequest, User } from "@/types/api";
import { userKeys } from "./useUsers";

/**
 * Hook to create a new user
 * @returns Mutation function for creating users
 */
export const useCreateUser = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: CreateUserRequest) => usersApi.create(data),
		onSuccess: (newUser: User) => {
			queryClient.invalidateQueries({ queryKey: userKeys.all });

			toast({
				title: "User created",
				description: `User ${newUser.email} has been created successfully.`,
				variant: "success",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Failed to create user",
				description: error?.message || "An unexpected error occurred.",
				variant: "destructive",
			});
		},
	});
};

/**
 * Hook to update an existing user
 * @returns Mutation function for updating users
 */
export const useUpdateUser = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: number; data: UpdateUserRequest }) =>
			usersApi.update(id, data),
		onSuccess: (updatedUser: User) => {
			queryClient.setQueryData(userKeys.detail(updatedUser.id), updatedUser);
			queryClient.invalidateQueries({ queryKey: userKeys.lists() });

			toast({
				title: "User updated",
				description: `User ${updatedUser.email} has been updated successfully.`,
				variant: "success",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Failed to update user",
				description: error?.message || "An unexpected error occurred.",
				variant: "destructive",
			});
		},
	});
};

/**
 * Hook to delete a user
 * @returns Mutation function for deleting users
 */
export const useDeleteUser = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: number) => usersApi.delete(id),
		onSuccess: (_, deletedUserId) => {
			queryClient.removeQueries({ queryKey: userKeys.detail(deletedUserId) });
			queryClient.invalidateQueries({ queryKey: userKeys.lists() });
			queryClient.invalidateQueries({ queryKey: ["users"] });

			toast({
				title: "User deleted",
				description: "User has been deleted successfully.",
				variant: "success",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Failed to delete user",
				description: error?.message || "An unexpected error occurred.",
				variant: "destructive",
			});
		},
	});
};

/**
 * Hook to unlock a user account
 * @returns Mutation function for unlocking users
 */
export const useUnlockUser = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: number) => usersApi.unlock(id),
		onSuccess: (unlockedUser: User) => {
			queryClient.setQueryData(userKeys.detail(unlockedUser.id), unlockedUser);
			queryClient.invalidateQueries({ queryKey: userKeys.lists() });

			toast({
				title: "User unlocked",
				description: `User ${unlockedUser.email} has been unlocked successfully.`,
				variant: "success",
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Failed to unlock user",
				description: error?.message || "An unexpected error occurred.",
				variant: "destructive",
			});
		},
	});
};
