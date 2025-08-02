import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
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
	const { toast } = useToast();

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
			// Invalidate records queries for this collection
			queryClient.invalidateQueries({ queryKey: ["records", collectionName] });

			// Invalidate all records query
			queryClient.invalidateQueries({ queryKey: ["records", "all"] });

			// Invalidate collection stats
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
	const { toast } = useToast();

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
			// Invalidate records queries for this collection
			queryClient.invalidateQueries({ queryKey: ["records", collectionName] });

			// Update specific record cache
			queryClient.setQueryData(
				["records", collectionName, recordId],
				updatedRecord,
			);

			// Invalidate all records query
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
	const { toast } = useToast();

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
			// Invalidate records queries for this collection
			queryClient.invalidateQueries({ queryKey: ["records", collectionName] });

			// Remove from specific record cache
			queryClient.removeQueries({
				queryKey: ["records", collectionName, recordId],
			});

			// Invalidate all records query
			queryClient.invalidateQueries({ queryKey: ["records", "all"] });

			// Invalidate collection stats
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
	const { toast } = useToast();

	return useMutation({
		mutationFn: async ({
			collectionName,
			recordIds,
		}: {
			collectionName: string;
			recordIds: number[];
		}) => {
			// Execute deletions in parallel
			await Promise.all(
				recordIds.map((id) => recordsApi.delete(collectionName, id)),
			);
			return { collectionName, recordIds };
		},
		onSuccess: ({ collectionName, recordIds }) => {
			// Invalidate records queries for this collection
			queryClient.invalidateQueries({ queryKey: ["records", collectionName] });

			// Remove from specific record caches
			recordIds.forEach((recordId) => {
				queryClient.removeQueries({
					queryKey: ["records", collectionName, recordId],
				});
			});

			// Invalidate all records query
			queryClient.invalidateQueries({ queryKey: ["records", "all"] });

			// Invalidate collection stats
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
