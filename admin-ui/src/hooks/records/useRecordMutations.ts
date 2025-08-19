import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { recordsApi } from "@/lib/api";
import type {
	CreateRecordRequest,
	Record,
	UpdateRecordRequest,
} from "@/types/api";

/**
 * Hook for creating a new record in a collection
 */
export const useCreateRecord = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			collectionName,
			data,
		}: {
			collectionName: string;
			data: CreateRecordRequest;
		}) => {
			const result = await recordsApi.create(collectionName, data);
			return result;
		},
		onSuccess: (_, { collectionName }) => {
			queryClient.invalidateQueries({ queryKey: ["records", collectionName] });
			queryClient.invalidateQueries({
				queryKey: ["collectionRecords", collectionName],
				exact: false,
			});

			queryClient.invalidateQueries({ queryKey: ["records", "all"] });

			queryClient.invalidateQueries({ queryKey: ["collections", "stats"] });
			queryClient.invalidateQueries({ queryKey: ["collections"] });

			toast({
				title: "Success",
				description: "Record created successfully",
				variant: "success",
			});
		},
		onError: (error: Error) => {
			const message = error?.message || "Failed to create record";
			toast({
				title: "Error",
				description: message,
				variant: "destructive",
			});
		},
	});
};

/**
 * Hook for updating an existing record
 */
export const useUpdateRecord = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			collectionName,
			recordId,
			data,
		}: {
			collectionName: string;
			recordId: number;
			data: UpdateRecordRequest;
		}) => {
			return await recordsApi.update(collectionName, recordId, data);
		},
		onSuccess: (updatedRecord: Record, { collectionName, recordId }) => {
			queryClient.invalidateQueries({ queryKey: ["records", collectionName] });
			queryClient.invalidateQueries({
				queryKey: ["collectionRecords", collectionName],
				exact: false,
			});

			queryClient.setQueryData(
				["records", collectionName, recordId],
				updatedRecord,
			);

			queryClient.invalidateQueries({ queryKey: ["records", "all"] });

			toast({
				title: "Success",
				description: "Record updated successfully",
				variant: "success",
			});
		},
		onError: (error: Error) => {
			const message = error?.message || "Failed to update record";
			toast({
				title: "Error",
				description: message,
				variant: "destructive",
			});
		},
	});
};

/**
 * Hook for deleting a record
 */
export const useDeleteRecord = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			collectionName,
			recordId,
		}: {
			collectionName: string;
			recordId: number;
		}) => {
			await recordsApi.delete(collectionName, recordId);
			return { collectionName, recordId };
		},
		onSuccess: ({ collectionName, recordId }) => {
			queryClient.invalidateQueries({ queryKey: ["records", collectionName] });
			queryClient.invalidateQueries({
				queryKey: ["collectionRecords", collectionName],
				exact: false,
			});

			queryClient.removeQueries({
				queryKey: ["records", collectionName, recordId],
			});

			queryClient.invalidateQueries({ queryKey: ["records", "all"] });

			queryClient.invalidateQueries({ queryKey: ["collections", "stats"] });
			queryClient.invalidateQueries({ queryKey: ["collections"] });

			toast({
				title: "Success",
				description: "Record deleted successfully",
				variant: "success",
			});
		},
		onError: (error: Error) => {
			const message = error?.message || "Failed to delete record";
			toast({
				title: "Error",
				description: message,
				variant: "destructive",
			});
		},
	});
};

/**
 * Hook for bulk operations on records
 */
export const useBulkDeleteRecords = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			collectionName,
			recordIds,
		}: {
			collectionName: string;
			recordIds: number[];
		}) => {
			await Promise.all(
				recordIds.map((id) => recordsApi.delete(collectionName, id)),
			);
			return { collectionName, recordIds };
		},
		onSuccess: ({ collectionName, recordIds }) => {
			queryClient.invalidateQueries({ queryKey: ["records", collectionName] });
			queryClient.invalidateQueries({
				queryKey: ["collectionRecords", collectionName],
				exact: false,
			});

			recordIds.forEach((recordId) => {
				queryClient.removeQueries({
					queryKey: ["records", collectionName, recordId],
				});
			});

			queryClient.invalidateQueries({ queryKey: ["records", "all"] });

			queryClient.invalidateQueries({ queryKey: ["collections", "stats"] });
			queryClient.invalidateQueries({ queryKey: ["collections"] });

			toast({
				title: "Success",
				description: `${recordIds.length} records deleted successfully`,
				variant: "success",
			});
		},
		onError: (error: Error) => {
			const message = error?.message || "Failed to delete records";
			toast({
				title: "Error",
				description: message,
				variant: "destructive",
			});
		},
	});
};
