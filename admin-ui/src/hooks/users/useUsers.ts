import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import type { User, UsersListParams } from "@/types/api";

// Query keys for users
export const userKeys = {
	all: ["users"] as const,
	lists: () => [...userKeys.all, "list"] as const,
	list: (options?: UsersListParams) => [...userKeys.lists(), options] as const,
	details: () => [...userKeys.all, "detail"] as const,
	detail: (id: number) => [...userKeys.details(), id] as const,
	profile: () => [...userKeys.all, "profile"] as const,
};

// Get all users with optional filtering, sorting, and pagination
export const useUsers = (options?: UsersListParams) => {
	return useQuery({
		queryKey: userKeys.list(options),
		queryFn: () => usersApi.list(options),
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
	});
};

// Get a single user by ID
export const useUser = (id: number) => {
	return useQuery({
		queryKey: userKeys.detail(id),
		queryFn: () => usersApi.get(id),
		enabled: !!id,
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000, // 10 minutes
	});
};

// Get all users without pagination (for dropdowns, etc.)
export const useAllUsers = () => {
	return useQuery({
		queryKey: [...userKeys.all, "all"],
		queryFn: () => usersApi.list({ limit: 1000 }), // Get large number for "all" users
		staleTime: 10 * 60 * 1000, // 10 minutes
		gcTime: 30 * 60 * 1000, // 30 minutes
	});
};
