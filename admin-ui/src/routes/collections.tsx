import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Calendar,
	Database,
	Edit3,
	FileText,
	Plus,
	Settings,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import {
	CollectionDetailsSheet,
	CollectionPermissionsSheet,
	CollectionsHeader,
	CreateCollectionSheet,
	EditCollectionSheet,
} from "@/components/collections";
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
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { useDeleteCollection } from "@/hooks/collections/useCollectionMutations";
import { useCollections } from "@/hooks/collections/useCollections";
import { useClientStore } from "@/stores/client.store";
import type { Collection } from "@/types/api";

export default function CollectionsComponent() {
	// React Query for data fetching
	const { data, isLoading, error } = useCollections();

	// Mutation for deleting collections
	const deleteCollectionMutation = useDeleteCollection();

	const collections = data?.collections || [];
	const collectionRecordCounts = data?.recordCounts || {};
	const loading = isLoading;

	// UI store for modals and sheets
	const modals = useClientStore((state) => state.ui.modals);
	const sheets = useClientStore((state) => state.ui.sheets);
	const openModal = useClientStore((state) => state.openModal);
	const closeModal = useClientStore((state) => state.closeModal);
	const openSheet = useClientStore((state) => state.openSheet);
	const closeSheet = useClientStore((state) => state.closeSheet);

	// Local UI states
	const [searchTerm, setSearchTerm] = useState("");
	const [collectionToDelete, setCollectionToDelete] = useState<string | null>(
		null,
	);
	const [selectedCollectionName, setSelectedCollectionName] = useState<
		string | null
	>(null);

	// Handle opening collection details
	const handleOpenDetails = (collectionName: string) => {
		setSelectedCollectionName(collectionName);
		openSheet("collectionDetails");
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
		openModal("editCollection");
	};

	// Handle opening collection permissions
	const handleOpenPermissions = (collectionName: string) => {
		setSelectedCollectionName(collectionName);
		openModal("permissions");
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
		openModal("deleteCollection");
	};

	const confirmDeleteCollection = async () => {
		if (!collectionToDelete) return;

		try {
			await deleteCollectionMutation.mutateAsync(collectionToDelete);
			// Close dialog
			closeModal("deleteCollection");
			setCollectionToDelete(null);
		} catch {
			// Error handling is done in the mutation hook
			closeModal("deleteCollection");
			setCollectionToDelete(null);
		}
	};

	const cancelDeleteCollection = () => {
		closeModal("deleteCollection");
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
					<h3 className="text-lg font-medium text-nocta-900 dark:text-nocta-100 mb-2">
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
			<CollectionsHeader
				collectionsCount={collections.length}
				searchTerm={searchTerm}
				onSearchChange={setSearchTerm}
				onCreateCollection={() => openModal("createCollection")}
			/>

			{/* Collections Grid */}
			{filteredCollections.length > 0 || (loading && !data) ? (
				<div className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{filteredCollections.map((collection) => (
							<Card
								key={collection.name}
								className="dashboard-card group hover:shadow-lg transition-all duration-200 h-full min-h-80"
							>
								<CardHeader className="pb-3 p-3">
									<div className="flex items-center justify-between">
										<CardTitle className="flex items-center gap-2 text-base">
											<div className="p-1 rounded-md bg-nocta-100 dark:bg-nocta-800/30">
												<Database className="w-3.5 h-3.5 text-nocta-700 dark:text-nocta-300" />
											</div>
											<span className="truncate max-w-40">
												{collection.name}
											</span>
										</CardTitle>
										<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<Button
												variant="ghost"
												size="sm"
												className={`w-7 h-7 p-0 ${hasRecords(collection.name) ? "opacity-50 cursor-not-allowed" : ""}`}
												disabled={hasRecords(collection.name)}
												onClick={() => handleOpenEdit(collection.name)}
												title={
													hasRecords(collection.name)
														? `Editing disabled - collection contains records`
														: "Edit collection"
												}
											>
												<Edit3 className="w-3.5 h-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="w-7 h-7 p-0"
												onClick={() => handleOpenPermissions(collection.name)}
											>
												<Settings className="w-3.5 h-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="w-7 h-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
												onClick={() => handleDeleteCollection(collection.name)}
											>
												<Trash2 className="w-3.5 h-3.5" />
											</Button>
										</div>
									</div>
									<div className="text-xs text-nocta-600 dark:text-nocta-400 mt-1.5">
										{collection.schema?.fields?.length || 0} fields
										{collectionRecordCounts[collection.name] !== undefined && (
											<span
												className={`ml-2 ${
													hasRecords(collection.name)
														? "text-orange-600 dark:text-orange-400"
														: "text-green-600 dark:text-green-400"
												}`}
											>
												• {collectionRecordCounts[collection.name]} records
												{hasRecords(collection.name) && " (editing disabled)"}
											</span>
										)}
									</div>
								</CardHeader>
								<CardContent className="p-3 pt-0 flex flex-col h-64">
									<div className="flex flex-col h-full">
										{/* Schema Preview */}
										<div className="space-y-2">
											<h4 className="text-sm font-medium text-nocta-900 dark:text-nocta-100">
												Schema Fields
											</h4>
											<div className="space-y-1.5">
												{collection.schema?.fields
													?.slice(0, 3)
													.map((field, index) => (
														<div
															key={`${collection.name}-field-${field.name}-${index}`}
															className="p-2 bg-nocta-50 dark:bg-nocta-800/30 rounded-lg transition-all duration-200"
														>
															<div className="flex items-center justify-between">
																<div className="flex items-center gap-2">
																	<div className="w-1.5 h-1.5 rounded-full bg-nocta-400 dark:bg-nocta-500"></div>
																	<span className="font-medium text-xs text-nocta-900 dark:text-nocta-100">
																		{field.name}
																	</span>
																</div>
																<Badge
																	variant="secondary"
																	className="px-1.5 py-0.5 text-xs font-medium"
																>
																	{field.field_type}
																</Badge>
															</div>
														</div>
													))}
												{(collection.schema?.fields?.length || 0) > 3 && (
													<div className="pt-1.5">
														<p className="text-xs text-nocta-500 dark:text-nocta-500 text-center">
															+{(collection.schema?.fields?.length || 0) - 3}{" "}
															more fields
														</p>
													</div>
												)}
											</div>
										</div>

										{/* Footer - always at bottom */}
										<div className="mt-auto space-y-2.5">
											{/* Metadata */}
											<div className="pt-2.5 border-t border-nocta-200 dark:border-nocta-800/50">
												<div className="flex items-center justify-center text-xs text-nocta-500 dark:text-nocta-500">
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
											<div className="flex items-center gap-1.5">
												<Button
													variant="primary"
													size="sm"
													className="flex-1 px-2 py-1"
													onClick={() => handleOpenDetails(collection.name)}
												>
													<FileText className="w-3.5 h-3.5 mr-1.5" />
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
														className="w-full px-2 py-1"
													>
														<Database className="w-3.5 h-3.5 mr-1.5" />
														Records
													</Button>
												</Link>
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
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
							<h3 className="text-lg font-medium text-nocta-900 dark:text-nocta-100 mb-2">
								{searchTerm ? "No collections found" : "No collections yet"}
							</h3>
							<p className="text-nocta-600 dark:text-nocta-400 mb-4 max-w-sm mx-auto">
								{searchTerm
									? `No collections match "${searchTerm}". Try a different search term.`
									: "Get started by creating your first data collection to organize your records."}
							</p>
							{!searchTerm && (
								<Button onClick={() => openModal("createCollection")}>
									<Plus className="w-4 h-4 mr-2" />
									Create Collection
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Delete Confirmation Dialog */}
			<Dialog
				open={modals.deleteCollection}
				onOpenChange={(open) => !open && closeModal("deleteCollection")}
			>
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
				isOpen={modals.createCollection}
				onOpenChange={(open) => !open && closeModal("createCollection")}
			/>

			<CollectionDetailsSheet
				isOpen={sheets.collectionDetails}
				onOpenChange={(open) => !open && closeSheet("collectionDetails")}
				collection={selectedCollection}
			/>

			<EditCollectionSheet
				isOpen={modals.editCollection}
				onOpenChange={(open) => !open && closeModal("editCollection")}
				collection={selectedCollection}
			/>

			<CollectionPermissionsSheet
				isOpen={modals.permissions}
				onOpenChange={(open) => !open && closeModal("permissions")}
				collection={selectedCollection}
			/>
		</div>
	);
}

export const Route = createFileRoute("/collections")({
	component: CollectionsComponent,
});
