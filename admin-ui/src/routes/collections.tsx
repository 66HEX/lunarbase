import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Calendar,
	Database,
	Edit3,
	FileText,
	Plus,
	Search,
	Settings,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { CollectionDetailsSheet } from "@/components/collections/CollectionDetailsSheet";
import { CollectionPermissionsSheet } from "@/components/collections/CollectionPermissionsSheet";
import { CreateCollectionSheet } from "@/components/collections/CreateCollectionSheet";
import { EditCollectionSheet } from "@/components/collections/EditCollectionSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useCollectionsQuery } from "@/hooks/useCollectionsQuery";
import { CustomApiError } from "@/lib/api";
import { useCollectionsStore } from "@/stores/collections-persist.store";
import type { Collection } from "@/types/api";

export default function CollectionsComponent() {
	// React Query for data fetching
	const { data, isLoading, error } = useCollectionsQuery();

	// Zustand store for actions only
	const { deleteCollection } = useCollectionsStore();

	const collections = data?.collections || [];
	const collectionRecordCounts = data?.recordCounts || {};
	const loading = isLoading;

	const queryClient = useQueryClient();

	// Local UI states
	const [searchTerm, setSearchTerm] = useState("");
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [collectionToDelete, setCollectionToDelete] = useState<string | null>(
		null,
	);

	// Sheet states
	const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
	const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);
	const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
	const [isPermissionsSheetOpen, setIsPermissionsSheetOpen] = useState(false);
	const [selectedCollectionName, setSelectedCollectionName] = useState<
		string | null
	>(null);

	const { toast } = useToast();

	// Handle opening collection details
	const handleOpenDetails = (collectionName: string) => {
		setSelectedCollectionName(collectionName);
		setIsDetailsSheetOpen(true);
	};

	// Handle opening collection edit
	const handleOpenEdit = (collectionName: string) => {
		// Check if collection has records
		if (hasRecords(collectionName)) {
			toast({
				title: "Editing Blocked",
				description: `Cannot edit collection "${collectionName}" because it contains records. Editing field types may cause system failure.`,
				variant: "destructive",
				position: "bottom-center",
				duration: 5000,
			});
			return;
		}

		setSelectedCollectionName(collectionName);
		setIsEditSheetOpen(true);
	};

	// Handle opening collection permissions
	const handleOpenPermissions = (collectionName: string) => {
		setSelectedCollectionName(collectionName);
		setIsPermissionsSheetOpen(true);
	};
	// Helper function to check if collection has records
	const hasRecords = (collectionName: string): boolean => {
		return collectionRecordCounts[collectionName] > 0;
	};

	// Helper function to find collection by name
	const findCollectionByName = (name: string | null): Collection | null => {
		if (!name) return null;
		return collections.find((collection) => collection.name === name) || null;
	};

	// Get selected collection object
	const selectedCollection = findCollectionByName(selectedCollectionName);

	const handleDeleteCollection = async (name: string) => {
		setCollectionToDelete(name);
		setDeleteDialogOpen(true);
	};

	const confirmDeleteCollection = async () => {
		if (!collectionToDelete) return;

		try {
			await deleteCollection(collectionToDelete);

			// Invalidate and refetch collections query
			queryClient.invalidateQueries({ queryKey: ["collections"] });

			// Close dialog
			setDeleteDialogOpen(false);
			setCollectionToDelete(null);
			// Show success toast
			toast({
				title: "Collection deleted",
				description: `Collection "${collectionToDelete}" has been deleted successfully.`,
				variant: "success",
				position: "bottom-center",
				duration: 3000,
			});
		} catch (error) {
			console.error("Delete collection error:", error);
			let errorMessage = "Failed to delete collection";

			if (error instanceof CustomApiError) {
				errorMessage = error.message;
			} else if (error instanceof Error) {
				errorMessage = error.message;
			} else if (typeof error === "string") {
				errorMessage = error;
			}

			toast({
				title: "Error",
				description: errorMessage,
				variant: "destructive",
				position: "bottom-center",
				duration: 5000,
			});
			setDeleteDialogOpen(false);
			setCollectionToDelete(null);
		}
	};

	const cancelDeleteCollection = () => {
		setDeleteDialogOpen(false);
		setCollectionToDelete(null);
	};

	const filteredCollections = collections.filter((collection) =>
		collection.name.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	if (loading && !data) {
		return (
			<div className="flex items-center justify-center h-svh">
				<div className="text-center">
					<Spinner className="w-8 h-8 mx-auto mb-4" />
					<p className="text-nocta-600 dark:text-nocta-400">
						Loading collections...
					</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-svh">
				<div className="text-center">
					<div className="p-3 rounded-full bg-red-100 dark:bg-red-900/20 w-fit mx-auto mb-4">
						<Database className="w-8 h-8 text-red-600 dark:text-red-400" />
					</div>
					<h3 className="text-lg font-semibold text-nocta-900 dark:text-nocta-100 mb-2">
						Error loading collections
					</h3>
					<p className="text-nocta-600 dark:text-nocta-400 mb-4">
						{error.message || "Something went wrong"}
					</p>
					<Button onClick={() => window.location.reload()}>Try again</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-4xl font-bold text-nocta-900 dark:text-nocta-100">
							Collections
						</h1>
						<Badge
							variant="secondary"
							className="px-2 py-0.5 text-xs font-medium"
						>
							{collections.length} total
						</Badge>
					</div>
					<p className="text-lg text-nocta-600 dark:text-nocta-400">
						Manage your data collections and schemas
					</p>
				</div>
				<div className="flex items-center gap-3">
					<div className="relative max-w-md">
						<Input
							placeholder="Search collections..."
							leftIcon={
								<Search className="w-4 h-4 text-nocta-400 dark:text-nocta-500" />
							}
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-10"
						/>
					</div>
					<Button
						className="px-4 py-2"
						onClick={() => setIsCreateSheetOpen(true)}
					>
						<Plus className="w-4 h-4 mr-2" />
						Create Collection
					</Button>
				</div>
			</div>

			{/* Collections Grid */}
			{filteredCollections.length > 0 || (loading && !data) ? (
				<div className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{filteredCollections.map((collection) => (
							<Card
								key={collection.name}
								className="group hover:shadow-lg transition-all duration-200 h-full"
							>
								<CardHeader className="pb-4">
									<div className="flex items-start justify-between">
										<div className="flex items-center gap-3">
											<div className="p-2 rounded-lg bg-nocta-100 dark:bg-nocta-800/30">
												<Database className="w-5 h-5 text-nocta-700 dark:text-nocta-300" />
											</div>
											<div>
												<CardTitle className="text-lg font-semibold text-nocta-900 dark:text-nocta-100 truncate max-w-48">
													{collection.name}
												</CardTitle>
												<p className="text-sm text-nocta-600 dark:text-nocta-400 mt-1">
													{collection.schema?.fields?.length || 0} fields
													{collectionRecordCounts[collection.name] !==
														undefined && (
														<span
															className={`ml-2 text-xs ${
																hasRecords(collection.name)
																	? "text-orange-600 dark:text-orange-400"
																	: "text-green-600 dark:text-green-400"
															}`}
														>
															• {collectionRecordCounts[collection.name]}{" "}
															records
															{hasRecords(collection.name) &&
																" (editing disabled)"}
														</span>
													)}
												</p>
											</div>
										</div>
										<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<Button
												variant="ghost"
												size="sm"
												className={`w-8 h-8 p-0 ${hasRecords(collection.name) ? "opacity-50 cursor-not-allowed" : ""}`}
												disabled={hasRecords(collection.name)}
												onClick={() => handleOpenEdit(collection.name)}
												title={
													hasRecords(collection.name)
														? `Editing disabled - collection contains records`
														: "Edit collection"
												}
											>
												<Edit3 className="w-4 h-4" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="w-8 h-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
												onClick={() => handleDeleteCollection(collection.name)}
											>
												<Trash2 className="w-4 h-4" />
											</Button>
										</div>
									</div>
								</CardHeader>
								<CardContent className="flex flex-col h-72">
									<div className="flex flex-col h-full">
										{/* Schema Preview */}
										<div className="space-y-2 ">
											<h4 className="text-sm font-medium text-nocta-900 dark:text-nocta-100">
												Schema Fields
											</h4>
											<div className="space-y-1">
												{collection.schema?.fields
													?.slice(0, 3)
													.map((field, index) => (
														<div
															key={`${collection.name}-field-${field.name}-${index}`}
															className="flex items-center justify-between text-sm"
														>
															<span className="text-nocta-700 dark:text-nocta-300">
																{field.name}
															</span>
															<Badge variant="secondary" className="text-xs">
																{field.field_type}
															</Badge>
														</div>
													))}
												{(collection.schema?.fields?.length || 0) > 3 && (
													<p className="text-xs text-nocta-500 dark:text-nocta-500">
														+{(collection.schema?.fields?.length || 0) - 3} more
														fields
													</p>
												)}
											</div>
										</div>

										{/* Footer - always at bottom */}
										<div className="mt-auto space-y-3">
											{/* Metadata */}
											<div className="pt-3 border-t border-nocta-200 dark:border-nocta-800/50">
												<div className="flex items-center justify-between text-xs text-nocta-500 dark:text-nocta-500">
													<div className="flex items-center gap-1">
														<Calendar className="w-3 h-3" />
														<span>
															Created{" "}
															{new Date(
																collection.created_at,
															).toLocaleDateString()}
														</span>
													</div>
												</div>
											</div>

											{/* Actions */}
											<div className="flex items-center gap-2">
												<Button
													variant="primary"
													size="sm"
													className="w-full flex-1"
													onClick={() => handleOpenDetails(collection.name)}
												>
													<FileText className="w-4 h-4 mr-2" />
													Details
												</Button>
												<Link
													to="/records/$collection"
													params={{ collection: collection.name }}
													className="flex-1"
												>
													<Button
														variant="secondary"
														size="sm"
														className="w-full"
													>
														<Database className="w-4 h-4 mr-2" />
														Records
													</Button>
												</Link>
												<Button
													variant="ghost"
													size="sm"
													className="w-8 h-8 p-0"
													onClick={() => handleOpenPermissions(collection.name)}
												>
													<Settings className="w-4 h-4" />
												</Button>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
					{/* Subtle loading indicator for data refresh */}
					{loading && data && (
						<div className="flex items-center justify-center py-2">
							<div className="flex items-center gap-2 text-sm text-nocta-500 dark:text-nocta-400">
								<Spinner className="w-4 h-4" />
								<span>Updating...</span>
							</div>
						</div>
					)}
				</div>
			) : (
				<Card>
					<CardContent className="py-12">
						<div className="text-center">
							<div className="p-3 rounded-full bg-nocta-100 dark:bg-nocta-800/30 w-fit mx-auto mb-4">
								<Database className="w-8 h-8 text-nocta-400 dark:text-nocta-500" />
							</div>
							<h3 className="text-lg font-semibold text-nocta-900 dark:text-nocta-100 mb-2">
								{searchTerm ? "No collections found" : "No collections yet"}
							</h3>
							<p className="text-nocta-600 dark:text-nocta-400 mb-4 max-w-sm mx-auto">
								{searchTerm
									? `No collections match "${searchTerm}". Try a different search term.`
									: "Get started by creating your first data collection to organize your records."}
							</p>
							{!searchTerm && (
								<Button onClick={() => setIsCreateSheetOpen(true)}>
									<Plus className="w-4 h-4 mr-2" />
									Create Collection
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Delete Confirmation Dialog */}
			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent size="sm">
					<DialogHeader>
						<DialogTitle>Delete Collection</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete collection "{collectionToDelete}"?
							This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogActions>
							<DialogClose asChild>
								<Button variant="ghost" onClick={cancelDeleteCollection}>
									Cancel
								</Button>
							</DialogClose>
							<Button variant="primary" onClick={confirmDeleteCollection}>
								Delete
							</Button>
						</DialogActions>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Sheet components */}
			<CreateCollectionSheet
				isOpen={isCreateSheetOpen}
				onOpenChange={setIsCreateSheetOpen}
			/>

			<CollectionDetailsSheet
				isOpen={isDetailsSheetOpen}
				onOpenChange={setIsDetailsSheetOpen}
				collection={selectedCollection}
			/>

			<EditCollectionSheet
				isOpen={isEditSheetOpen}
				onOpenChange={setIsEditSheetOpen}
				collection={selectedCollection}
			/>

			<CollectionPermissionsSheet
				isOpen={isPermissionsSheetOpen}
				onOpenChange={setIsPermissionsSheetOpen}
				collection={selectedCollection}
			/>
		</div>
	);
}

export const Route = createFileRoute("/collections")({
	component: CollectionsComponent,
});
