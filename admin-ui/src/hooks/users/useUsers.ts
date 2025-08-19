import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import type { UsersListParams } from "@/types/api";

export const userKeys = {
	all: ["users"] as const,
	lists: () => [...userKeys.all, "list"] as const,
	list: (options?: UsersListParams) => [...userKeys.lists(), options] as const,
	details: () => [...userKeys.all, "detail"] as const,
	detail: (id: number) => [...userKeys.details(), id] as const,
	profile: () => [...userKeys.all, "profile"] as const,
};

/**
 * Hook to fetch users with optional filtering, sorting, and pagination
 * @param options - Optional parameters for filtering, sorting, and pagination
 * @returns Query result containing users data
 */
export const useUsers = (options?: UsersListParams) => {
	return useQuery({
		queryKey: userKeys.list(options),
		queryFn: () => usersApi.list(options),
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000
	});
};

/**
 * Hook to fetch a single user by ID
 * @param id - User ID
 * @returns Query result containing user data
 */
export const useUser = (id: number) => {
	return useQuery({
		queryKey: userKeys.detail(id),
		queryFn: () => usersApi.get(id),
		enabled: !!id,
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000
	});
};

/**
 * Hook to fetch all users without pagination (for dropdowns, etc.)
 * @returns Query result containing all users data
 */
export const useAllUsers = () => {
	return useQuery({
		queryKey: [...userKeys.all, "all"],
		queryFn: () => usersApi.list({ limit: 1000 }),
		staleTime: 10 * 60 * 1000,
		gcTime: 30 * 60 * 1000
	});
};

interface UseUsersWithPaginationParams {
	currentPage: number;
	pageSize: number;
	searchTerm: string;
}

/**
 * Hook to fetch users with pagination and search functionality
 * @param params - Pagination and search parameters
 * @returns Query result containing paginated users data
 */
export const useUsersWithPagination = ({
	currentPage,
	pageSize,
	searchTerm,
}: UseUsersWithPaginationParams) => {
	return useQuery({
		queryKey: ["users", { page: currentPage, pageSize, search: searchTerm }],
		queryFn: async () => {
			const params: UsersListParams = {
				limit: pageSize,
				offset: (currentPage - 1) * pageSize,
				sort: "created_at",
				search: searchTerm || undefined,
			};

			const data = await usersApi.list(params);

			if (!data || !data.users || !data.pagination) {
				throw new Error("Unexpected response format");
			}

			return data;
		},
		placeholderData: (previousData) => previousData,
		staleTime: 30 * 1000,
		gcTime: 5 * 60 * 1000
	});
};
