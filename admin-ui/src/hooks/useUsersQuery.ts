import { useQuery } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import type { UsersListParams } from "@/types/api";

interface UseUsersQueryParams {
	currentPage: number;
	pageSize: number;
	searchTerm: string;
}

export const useUsersQuery = ({
	currentPage,
	pageSize,
	searchTerm,
}: UseUsersQueryParams) => {
	return useQuery({
		queryKey: ["users", { page: currentPage, pageSize, search: searchTerm }],
		queryFn: async () => {
			const params: UsersListParams = {
				limit: pageSize,
				offset: (currentPage - 1) * pageSize,
				sort: "created_at",
				filter: searchTerm ? `email:like:%${searchTerm}%` : undefined,
			};

			const data = await usersApi.list(params);

			if (!data || !data.users || !data.pagination) {
				throw new Error("Unexpected response format");
			}

			return data;
		},
		placeholderData: (previousData) => previousData, // keepPreviousData equivalent
		staleTime: 30 * 1000, // 30 seconds
		gcTime: 5 * 60 * 1000, // 5 minutes
	});
};
