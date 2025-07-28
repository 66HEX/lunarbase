import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { ownershipApi } from "@/lib/api";
import type { TransferOwnershipRequest } from "@/types/api";

/**
 * Hook for transferring record ownership
 */
export const useTransferOwnership = () => {
	const queryClient = useQueryClient();
	const { toast } = useToast();

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

			// Invalidate related queries
			queryClient.invalidateQueries({
				queryKey: ["ownership"],
			});
			queryClient.invalidateQueries({
				queryKey: ["records", variables.collectionName],
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
