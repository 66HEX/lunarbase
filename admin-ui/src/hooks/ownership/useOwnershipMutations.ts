import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { ownershipApi } from "@/lib/api";
import type { TransferOwnershipRequest } from "@/types/api";

/**
 * Hook for transferring record ownership
 */
export const useTransferOwnership = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			collectionName,
			recordId,
			data,
		}: {
			collectionName: string;
			recordId: number;
			data: TransferOwnershipRequest;
		}) => ownershipApi.transferOwnership(collectionName, recordId, data),
		onSuccess: (_, variables) => {
			toast({
				title: "Ownership transferred",
				description: "Record ownership has been successfully transferred.",
				variant: "success",
			});

			queryClient.invalidateQueries({
				queryKey: ["ownership"],
			});
			queryClient.invalidateQueries({
				queryKey: ["records", variables.collectionName],
			});
			queryClient.invalidateQueries({
				queryKey: ["collectionRecords", variables.collectionName],
				exact: false,
			});
			queryClient.invalidateQueries({
				queryKey: ["record", variables.collectionName, variables.recordId],
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Transfer failed",
				description: error.message || "Failed to transfer ownership.",
				variant: "destructive",
			});
		},
	});
};
