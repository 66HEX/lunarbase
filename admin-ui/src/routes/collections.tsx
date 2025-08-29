import { createFileRoute, Link } from "@tanstack/react-router";
import {
	CalendarIcon,
	DatabaseIcon,
	PencilIcon,
	FileTextIcon,
	PlusIcon,
	GearIcon,
	TrashIcon,
} from "@phosphor-icons/react";
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
import {
	useCollections,
	useDebounce,
	useDeleteCollection,
	usePrefetch,
} from "@/hooks/";
import { useClientStore } from "@/stores/client.store";
import type { Collection } from "@/types/api";

export default function CollectionsComponent() {
	const { data, isLoading, error } = useCollections();

	const deleteCollectionMutation = useDeleteCollection();

	const { prefetchCollectionRecords, prefetchCollection, prefetchPermissions } =
		usePrefetch();

	const collections = data?.collections || [];
	const collectionRecordCounts = data?.recordCounts || {};
	const loading = isLoading;

	const modals = useClientStore((state) => state.ui.modals);
	const sheets = useClientStore((state) => state.ui.sheets);
	const openModal = useClientStore((state) => state.openModal);
	const closeModal = useClientStore((state) => state.closeModal);
	const openSheet = useClientStore((state) => state.openSheet);
	const closeSheet = useClientStore((state) => state.closeSheet);

	const [localSearchTerm, setLocalSearchTerm] = useState("");
	const searchTerm = useDebounce(localSearchTerm, 300);
	const [collectionToDelete, setCollectionToDelete] = useState<string | null>(
		null,
	);
	const [selectedCollectionName, setSelectedCollectionName] = useState<
		string | null
	>(null);

	const handleOpenDetails = (collectionName: string) => {
		setSelectedCollectionName(collectionName);
		openSheet("collectionDetails");
	};

	const handleOpenEdit = (collectionName: string) => {
		if (hasRecords(collectionName)) {
			toast({
				title: "Editing Blocked",
				description: `Cannot edit collection "${collectionName}" because it contains records. Editing field types may cause system failure.`,
				variant: "destructive",
				position: "bottom-right",
				duration: 5000,
			});
			return;
		}

		setSelectedCollectionName(collectionName);
		openSheet("editCollection");
	};

	const handleOpenPermissions = (collectionName: string) => {
		setSelectedCollectionName(collectionName);
		openSheet("permissions");
	};

	const hasRecords = (collectionName: string): boolean => {
		return collectionRecordCounts[collectionName] > 0;
	};

	const findCollectionByName = (name: string | null): Collection | null => {
		if (!name) return null;
		return collections.find((collection) => collection.name === name) || null;
	};

	const selectedCollection = findCollectionByName(selectedCollectionName);

	const handleDeleteCollection = async (name: string) => {
		setCollectionToDelete(name);
		openModal("deleteCollection");
	};

	const confirmDeleteCollection = async () => {
		if (!collectionToDelete) return;

		try {
			await deleteCollectionMutation.mutateAsync(collectionToDelete);

			closeModal("deleteCollection");
			setCollectionToDelete(null);
		} catch {
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
						<DatabaseIcon size={32} />
					</div>
					<h3 className="text-lg font-light text-nocta-900 dark:text-nocta-100 mb-2">
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
			<CollectionsHeader
				collectionsCount={collections.length}
				searchTerm={localSearchTerm}
				onSearchChange={setLocalSearchTerm}
				onCreateCollection={() => openSheet("createCollection")}
			/>

			{filteredCollections.length > 0 || (loading && !data) ? (
				<div className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{filteredCollections.map((collection) => (
							<Card
								key={collection.name}
								className="dashboard-card group hover:shadow-lg transition-all duration-200 h-full min-h-80"
							>
								<CardHeader className="pb-3 p-3 mb-2">
									<div className="flex items-center justify-between">
										<CardTitle className="flex items-center gap-2 text-base">
											<div className="p-1 rounded-md bg-nocta-100 dark:bg-nocta-800/30">
												<DatabaseIcon size={14} />
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
												onClick={() => handleOpenEdit(collection.name)}
												title={
													hasRecords(collection.name)
														? `Editing disabled - collection contains records`
														: "Edit collection"
												}
											>
												<PencilIcon size={14} />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="w-7 h-7 p-0"
												onClick={() => handleOpenPermissions(collection.name)}
												onMouseEnter={() =>
													prefetchPermissions(collection.name)
												}
											>
												<GearIcon size={14} />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="w-7 h-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
												onClick={() => handleDeleteCollection(collection.name)}
											>
												<TrashIcon size={14} />
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
										<div className="space-y-2">
											<h4 className="text-sm font-light text-nocta-900 dark:text-nocta-100">
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
																	<span className="font-light text-xs text-nocta-900 dark:text-nocta-100">
																		{field.name}
																	</span>
																</div>
																<Badge
																	variant="secondary"
																	className="px-1.5 py-0.5 text-xs font-light"
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

										<div className="mt-auto space-y-2.5">
											<div className="pt-2.5 border-t border-nocta-200 dark:border-nocta-800/50">
												<div className="flex items-center justify-center text-xs text-nocta-500 dark:text-nocta-500">
													<div className="flex items-center gap-1">
														<CalendarIcon size={12} />
														<span>
															Created{" "}
															{new Date(
																collection.created_at,
															).toLocaleDateString()}
														</span>
													</div>
												</div>
											</div>

											<div className="flex items-center gap-1.5">
												<Button
													variant="primary"
													size="sm"
													className="flex-1 px-2 py-1"
													onClick={() => handleOpenDetails(collection.name)}
												>
													<span className="mr-1.5">
												<FileTextIcon size={14} />
											</span>
													Details
												</Button>
												<Link
													to="/records/$collection"
													params={{ collection: collection.name }}
													className="flex-1"
													onMouseEnter={() => {
														prefetchCollectionRecords(collection.name);
														prefetchCollection(collection.name);
													}}
												>
													<Button
														variant="secondary"
														size="sm"
														className="w-full px-2 py-1"
													>
														<span className="mr-1.5">
														<DatabaseIcon size={14} />
													</span>
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
								<DatabaseIcon size={32} />
							</div>
							<h3 className="text-lg font-light text-nocta-900 dark:text-nocta-100 mb-2">
								{searchTerm ? "No collections found" : "No collections yet"}
							</h3>
							<p className="text-nocta-600 dark:text-nocta-400 mb-4 max-w-sm mx-auto">
								{searchTerm
									? `No collections match "${searchTerm}". Try a different search term.`
									: "Get started by creating your first data collection to organize your records."}
							</p>
							{!searchTerm && (
								<Button onClick={() => openSheet("createCollection")}>
									<span className="mr-2">
							<PlusIcon size={16} />
						</span>
									Create Collection
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			)}

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

			<CreateCollectionSheet
				isOpen={sheets.createCollection}
				onOpenChange={(open) => !open && closeSheet("createCollection")}
			/>

			<CollectionDetailsSheet
				isOpen={sheets.collectionDetails}
				onOpenChange={(open) => !open && closeSheet("collectionDetails")}
				collection={selectedCollection}
			/>

			<EditCollectionSheet
				isOpen={sheets.editCollection}
				onOpenChange={(open) => !open && closeSheet("editCollection")}
				collection={selectedCollection}
			/>

			<CollectionPermissionsSheet
				isOpen={sheets.permissions}
				onOpenChange={(open) => !open && closeSheet("permissions")}
				collection={selectedCollection}
			/>
		</div>
	);
}

export const Route = createFileRoute("/collections")({
	component: CollectionsComponent,
});
