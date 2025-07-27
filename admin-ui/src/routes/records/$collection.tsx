import { useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { ArrowLeft, Edit3, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
	CollectionRecordsEditSheet,
	CollectionRecordsHeader,
	DeleteRecordDialog,
	EmptyCollectionRecordsState,
} from "@/components/records";
import { OwnershipBadge } from "@/components/ownership";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import {
	useCreateRecord,
	useDeleteRecord,
	useUpdateRecord,
} from "@/hooks/records/useRecordMutations";
import { useCollectionRecordsQuery } from "@/hooks/useCollectionRecordsQuery";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/useToast";
import { useAuthStore } from "@/stores/auth-persist.store";
import { CustomApiError, collectionsApi } from "@/lib/api";
import { useUI, useUIActions } from "@/stores/client.store";
import type { ApiRecord, Collection, RecordData } from "@/types/api";

// Use ApiRecord instead of Record to avoid conflict with TypeScript's built-in Record type
type Record = ApiRecord;

// Helper function to safely parse user ID from record data
const getUserId = (value: unknown): number | undefined => {
	if (typeof value === 'number') return value;
	if (typeof value === 'string') {
		const parsed = parseInt(value, 10);
		return isNaN(parsed) ? undefined : parsed;
	}
	return undefined;
};

// Helper function for formatting field values
const formatFieldValue = (value: unknown, maxLength: number = 50): string => {
	if (value === null || value === undefined) return "-";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (typeof value === "object") {
		const jsonString = JSON.stringify(value);
		if (jsonString.length > maxLength) {
			return jsonString.substring(0, maxLength) + "...";
		}
		return jsonString;
	}
	const stringValue = String(value);
	if (stringValue.length > maxLength) {
		return stringValue.substring(0, maxLength) + "...";
	}
	return stringValue;
};

export default function RecordComponent() {
	const { collection: collectionName } = useParams({
		from: "/records/$collection",
	});
	const navigate = useNavigate({ from: "/records/$collection" });
	const { toast } = useToast();
	const { user } = useAuthStore();
	const queryClient = useQueryClient();

	// React Query mutations
	const createRecordMutation = useCreateRecord();
	const updateRecordMutation = useUpdateRecord();
	const deleteRecordMutation = useDeleteRecord();

	const [collection, setCollection] = useState<Collection | null>(null);
	const [recordToDelete, setRecordToDelete] = useState<number | null>(null);

	// UI store for modals and sheets
	const { modals, sheets } = useUI();
	const { openModal, closeModal, openSheet, closeSheet } = useUIActions();

	// Search and pagination state
	const [localSearchTerm, setLocalSearchTerm] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const pageSize = 10;

	// Debounce search term
	const debouncedSearchTerm = useDebounce(localSearchTerm, 300);

	// Use TanStack Query for records
	const {
		data: recordsData,
		isLoading,
		error,
		refetch,
	} = useCollectionRecordsQuery({
		collectionName: collectionName || "",
		currentPage,
		pageSize,
		searchTerm: debouncedSearchTerm,
	});

	const records = recordsData?.records || [];
	const totalCount = recordsData?.pagination?.total_count || 0;

	// Local state for record data
	const [editingRecord, setEditingRecord] = useState<Record | null>(null);

	const fetchCollection = useCallback(async () => {
		if (!collectionName) return;

		try {
			const collectionResponse = await collectionsApi.get(collectionName);
			setCollection(collectionResponse.data);
		} catch (error) {
			const errorMessage =
				error instanceof CustomApiError
					? error.message
					: "Failed to fetch collection";
			toast({
				title: "Error",
				description: errorMessage,
				variant: "destructive",
				position: "bottom-center",
				duration: 3000,
			});
		}
	}, [collectionName, toast]);

	useEffect(() => {
		if (collectionName) {
			fetchCollection();
		}
	}, [collectionName, fetchCollection]);

	// Reset page when search term changes
	useEffect(() => {
		setCurrentPage(1);
	}, [debouncedSearchTerm]);

	// Refresh data when component becomes visible again
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (!document.hidden && collectionName) {
				refetch();
				fetchCollection();
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () =>
			document.removeEventListener("visibilitychange", handleVisibilityChange);
	}, [collectionName, refetch, fetchCollection]);

	const handleEditRecord = (record: Record) => {
		setEditingRecord(record);
		openSheet("editRecord");
	};

	const handleCreateRecord = async (data: RecordData) => {
		if (!collectionName) return;

		createRecordMutation.mutate(
			{
				collectionName,
				data: { data },
			},
			{
				onSuccess: () => {
					// Invalidate queries to refresh data
					queryClient.invalidateQueries({
						queryKey: ["collectionRecords", collectionName],
					});
				},
				onError: (error) => {
					throw error;
				},
			},
		);
	};

	const handleUpdateRecord = async (data: RecordData) => {
		if (!collectionName || !editingRecord) return;

		updateRecordMutation.mutate(
			{
				collectionName,
				recordId: editingRecord.id,
				data: { data },
			},
			{
				onSuccess: () => {
					closeSheet("editRecord");
					setEditingRecord(null);
					// Invalidate queries to refresh data
					queryClient.invalidateQueries({
						queryKey: ["collectionRecords", collectionName],
					});
				},
				onError: (error) => {
					throw error;
				},
			},
		);
	};

	const handleDeleteRecord = async (recordId: number) => {
		setRecordToDelete(recordId);
		openModal("deleteRecord");
	};

	const confirmDeleteRecord = async () => {
		if (!recordToDelete || !collectionName) return;

		deleteRecordMutation.mutate(
			{
				collectionName,
				recordId: recordToDelete,
			},
			{
				onSuccess: () => {
					closeModal("deleteRecord");
					setRecordToDelete(null);
					// Invalidate queries to refresh data
					queryClient.invalidateQueries({
						queryKey: ["collectionRecords", collectionName],
					});
				},
				onError: () => {
					closeModal("deleteRecord");
					setRecordToDelete(null);
				},
			},
		);
	};

	const handleSearchChange = (value: string) => {
		setLocalSearchTerm(value);
	};

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

	if (error) {
		return (
			<div className="space-y-6">
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						onClick={() => navigate({ to: "/records" })}
						className="p-2"
					>
						<ArrowLeft className="w-4 h-4" />
					</Button>
					<h1 className="text-4xl font-bold text-nocta-900 dark:text-nocta-100">
						Records - {collectionName}
					</h1>
				</div>
				<Alert variant="destructive">
					<AlertDescription>
						{error instanceof Error ? error.message : "An error occurred"}
					</AlertDescription>
				</Alert>
			</div>
		);
	}

	if (isLoading && !collection) {
		return (
			<div className="space-y-6">
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						onClick={() => navigate({ to: "/records" })}
						className="p-2"
					>
						<ArrowLeft className="w-4 h-4" />
					</Button>
					<h1 className="text-4xl font-bold text-nocta-900 dark:text-nocta-100">
						Records - {collectionName}
					</h1>
				</div>
				<div className="flex items-center justify-center py-12">
					<Spinner size="lg" />
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<CollectionRecordsHeader
				collectionName={collection?.display_name || collectionName}
				collection={collection}
				totalCount={totalCount}
				searchTerm={localSearchTerm}
				onSearchChange={handleSearchChange}
				onNavigateBack={() => navigate({ to: "/records" })}
				isSheetOpen={sheets.createRecord || false}
				onSheetOpenChange={(open) =>
					open ? openSheet("createRecord") : closeSheet("createRecord")
				}
				onCreateRecord={handleCreateRecord}
			/>

			{/* Records Table */}
			{records.length > 0 || isLoading ? (
				<div className="space-y-4">
					<div className="overflow-x-auto">
						<Table<ApiRecord>
							columns={[
								{
									key: "id",
									title: "ID",
									className: "w-16",
									render: (_value: unknown, record: ApiRecord) => (
										<div className="font-medium">{record.id}</div>
									),
								},
								{
									key: "data",
									title: "Data",
									render: (_value: unknown, record: ApiRecord) => {
										// Filter out ownership-related fields and ID since they're shown in separate columns
										const excludedFields = ['id', 'owner_id', 'author_id', 'created_by', 'user_id'];
										const filteredEntries = Object.entries(record.data)
											.filter(([key]) => !excludedFields.includes(key));
										
										return (
											<div className="flex gap-4">
												{filteredEntries
													.slice(0, 2)
													.map(([key, value]) => (
														<div key={key} className="text-sm">
															<span className="font-medium text-nocta-700 dark:text-nocta-300">
																{key}:
															</span>{" "}
															<span className="text-nocta-600 dark:text-nocta-400 truncate">
																{formatFieldValue(value)}
															</span>
														</div>
													))}
												{filteredEntries.length > 2 && (
													<div className="text-xs text-nocta-500 dark:text-nocta-500 mt-1">
														+{filteredEntries.length - 2} more fields
													</div>
												)}
											</div>
										);
									},
								},
								{
									key: "ownership",
									title: "Ownership",
									className: "w-32",
									render: (_value: unknown, record: ApiRecord) => (
												<OwnershipBadge
													ownership={{
														user_id: getUserId(record.data.user_id),
														created_by: getUserId(record.data.created_by),
														owner_id: getUserId(record.data.owner_id),
														author_id: getUserId(record.data.author_id),
													}}
													currentUserId={user?.id}
													size="sm"
												/>
											),
								},
								{
									key: "created_at",
									title: "Created",
									className: "w-32",
									render: (_value: unknown, record: ApiRecord) => (
										<div className="text-sm">
											<div className="text-nocta-900 dark:text-nocta-100">
												{new Date(record.created_at).toLocaleDateString()}
											</div>
											<div className="text-nocta-500 dark:text-nocta-500">
												{new Date(record.created_at).toLocaleTimeString()}
											</div>
										</div>
									),
								},
								{
									key: "actions",
									title: "Actions",
									className: "w-24",
									align: "left",
									render: (_value: unknown, record: ApiRecord) => (
										<div className="flex items-center gap-1">
											<Button
												variant="ghost"
												size="sm"
												className="w-8 h-8 p-0"
												onClick={() => handleEditRecord(record)}
												title="Edit record"
											>
												<Edit3 className="w-4 h-4" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="w-8 h-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
												onClick={() => handleDeleteRecord(record.id)}
												title="Delete record"
											>
												<Trash2 className="w-4 h-4" />
											</Button>
										</div>
									),
								},
							]}
							data={records}
							loading={isLoading}
							pagination={{
								current: currentPage,
								pageSize: pageSize,
								total: totalCount,
								onChange: handlePageChange,
							}}
						/>
					</div>
					{/* Subtle loading indicator for pagination */}
					{isLoading && (
						<div className="flex items-center justify-center py-2">
							<div className="flex items-center gap-2 text-sm text-nocta-500 dark:text-nocta-400">
								<Spinner className="w-4 h-4" />
								<span>Updating...</span>
							</div>
						</div>
					)}
				</div>
			) : (
				<EmptyCollectionRecordsState
					searchTerm={localSearchTerm}
					collectionName={collectionName}
					onAddRecord={() => openSheet("createRecord")}
				/>
			)}

			<CollectionRecordsEditSheet
				open={sheets.editRecord || false}
				onOpenChange={(open) =>
					open ? openSheet("editRecord") : closeSheet("editRecord")
				}
				record={editingRecord}
				collection={collection}
				onSubmit={handleUpdateRecord}
			/>

			<DeleteRecordDialog
				open={modals.deleteRecord || false}
				onOpenChange={(open) =>
					open ? openModal("deleteRecord") : closeModal("deleteRecord")
				}
				onConfirm={confirmDeleteRecord}
				onCancel={() => {
					closeModal("deleteRecord");
					setRecordToDelete(null);
				}}
			/>
		</div>
	);
}

export const Route = createFileRoute("/records/$collection")({
	component: RecordComponent,
});
