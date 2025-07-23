import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast";
import { collectionsApi, permissionsApi } from "@/lib/api";
import type {
	Collection,
	CreateCollectionRequest,
	UpdateCollectionRequest,
} from "@/types/api";

/**
 * Hook for creating a new collection
 */
export const useCreateCollection = () => {
	const queryClient = useQueryClient();
	const { toast } = useToast();

	return useMutation({
		mutationFn: async (data: CreateCollectionRequest) => {
			return await collectionsApi.create(data);
		},
		onSuccess: (newCollection: Collection) => {
			// Invalidate collections list
			queryClient.invalidateQueries({ queryKey: ["collections"] });

			// Optimistically add to cache
			queryClient.setQueryData(
				["collections"],
				(
					old:
						| {
								collections: Collection[];
								recordCounts: Record<string, number>;
						  }
						| undefined,
				) => {
					if (!old) return old;
					return {
						collections: [...old.collections, newCollection],
						recordCounts: {
							...old.recordCounts,
							[newCollection.name]: 0,
						},
					};
				},
			);

			toast({
				title: "Success",
				description: `Collection "${newCollection.name}" created successfully`,
				variant: "success",
			});
		},
		onError: (error: any) => {
			const message =
				error?.response?.data?.message || "Failed to create collection";
			toast({
				title: "Error",
				description: message,
				variant: "destructive",
			});
		},
	});
};

/**
 * Hook for updating an existing collection
 */
export const useUpdateCollection = () => {
	const queryClient = useQueryClient();
	const { toast } = useToast();

	return useMutation({
		mutationFn: async ({
			name,
			data,
		}: {
			name: string;
			data: UpdateCollectionRequest;
		}) => {
			return await collectionsApi.update(name, data);
		},
		onSuccess: (updatedCollection: Collection) => {
			// Invalidate collections list
			queryClient.invalidateQueries({ queryKey: ["collections"] });

			// Update specific collection cache
			queryClient.setQueryData(
				["collections", updatedCollection.name],
				updatedCollection,
			);

			// Optimistically update collections list
			queryClient.setQueryData(
				["collections"],
				(
					old:
						| {
								collections: Collection[];
								recordCounts: Record<string, number>;
						  }
						| undefined,
				) => {
					if (!old) return old;
					return {
						...old,
						collections: old.collections.map((collection) =>
							collection.name === updatedCollection.name
								? updatedCollection
								: collection,
						),
					};
				},
			);

			toast({
				title: "Success",
				description: `Collection "${updatedCollection.name}" updated successfully`,
				variant: "success",
			});
		},
		onError: (error: any) => {
			const message =
				error?.response?.data?.message || "Failed to update collection";
			toast({
				title: "Error",
				description: message,
				variant: "destructive",
			});
		},
	});
};

/**
 * Hook for deleting a collection
 */
export const useDeleteCollection = () => {
	const queryClient = useQueryClient();
	const { toast } = useToast();

	return useMutation({
		mutationFn: async (name: string) => {
			await collectionsApi.delete(name);
			return name;
		},
		onSuccess: (deletedName: string) => {
			// Invalidate collections list
			queryClient.invalidateQueries({ queryKey: ["collections"] });

			// Remove from cache
			queryClient.removeQueries({ queryKey: ["collections", deletedName] });

			// Optimistically remove from collections list
			queryClient.setQueryData(
				["collections"],
				(
					old:
						| {
								collections: Collection[];
								recordCounts: Record<string, number>;
						  }
						| undefined,
				) => {
					if (!old) return old;
					const { [deletedName]: removed, ...remainingCounts } =
						old.recordCounts;
					return {
						collections: old.collections.filter(
							(collection) => collection.name !== deletedName,
						),
						recordCounts: remainingCounts,
					};
				},
			);

			// Invalidate related queries
			queryClient.invalidateQueries({ queryKey: ["records", deletedName] });
			queryClient.invalidateQueries({ queryKey: ["permissions"] });

			toast({
				title: "Success",
				description: `Collection "${deletedName}" deleted successfully`,
				variant: "success",
			});
		},
		onError: (error: any) => {
			const message =
				error?.response?.data?.message || "Failed to delete collection";
			toast({
				title: "Error",
				description: message,
				variant: "destructive",
			});
		},
	});
};

/**
 * Hook for saving collection permissions
 */
export const useSaveCollectionPermissions = () => {
	const queryClient = useQueryClient();
	const { toast } = useToast();

	return useMutation({
		mutationFn: async ({
			collectionName,
			permissions,
		}: {
			collectionName: string;
			permissions: any;
		}) => {
			await permissionsApi.setCollectionPermission(permissions);
			return { collectionName, permissions };
		},
		onSuccess: ({ collectionName }) => {
			// Invalidate permissions queries
			queryClient.invalidateQueries({ queryKey: ["permissions"] });
			queryClient.invalidateQueries({
				queryKey: ["collections", collectionName],
			});

			toast({
				title: "Success",
				description: `Permissions for "${collectionName}" saved successfully`,
				variant: "success",
			});
		},
		onError: (error: any) => {
			const message =
				error?.response?.data?.message || "Failed to save permissions";
			toast({
				title: "Error",
				description: message,
				variant: "destructive",
			});
		},
	});
};
