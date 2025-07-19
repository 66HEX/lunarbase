import { useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import { ArrowLeft, Edit3, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useCollectionRecordsQuery } from "@/hooks/useCollectionRecordsQuery";
import { useDebounce } from "@/hooks/useDebounce";
import { CustomApiError, collectionsApi, recordsApi } from "@/lib/api";
import {
	CollectionRecordsHeader,
	CollectionRecordsEditSheet,
	EmptyCollectionRecordsState,
	DeleteRecordDialog,
} from "@/components/records";
import type {
	ApiRecord,
	Collection,
	CreateRecordRequest,
	RecordData,
} from "@/types/api";

// Use ApiRecord instead of Record to avoid conflict with TypeScript's built-in Record type
type Record = ApiRecord;

// Helper function for formatting field values
const formatFieldValue = (value: any): string => {
	if (value === null || value === undefined) return "-";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
};

export default function RecordComponent() {
	const { collection: collectionName } = useParams({
		from: "/records/$collection",
	});
	const navigate = useNavigate({ from: "/records/$collection" });
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [collection, setCollection] = useState<Collection | null>(null);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [recordToDelete, setRecordToDelete] = useState<number | null>(null);

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

	// Sheet state
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	// Edit sheet state
	const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
	const [editingRecord, setEditingRecord] = useState<Record | null>(null);

	useEffect(() => {
		if (collectionName) {
			fetchCollection();
		}
	}, [collectionName]);

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
	}, [collectionName, refetch]);

	const fetchCollection = async () => {
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
	};

	const handleEditRecord = (record: Record) => {
		setEditingRecord(record);
		setIsEditSheetOpen(true);
	};

	const handleCreateRecord = async (data: RecordData) => {
		if (!collectionName) return;

		try {
			const request: CreateRecordRequest = {
				data,
			};

			await recordsApi.create(collectionName, request);

			toast({
				title: "Success!",
				description: `Record has been created successfully.`,
				variant: "success",
				position: "bottom-center",
				duration: 3000,
			});

			// Invalidate queries to refresh data
			queryClient.invalidateQueries({
				queryKey: ["collectionRecords", collectionName],
			});
			queryClient.invalidateQueries({ queryKey: ["collections"] });
		} catch (error) {
			console.error("Record creation error:", error);

			let errorMessage = "Failed to create record";

			if (error instanceof CustomApiError) {
				errorMessage = error.message;
			} else if (error instanceof Error) {
				errorMessage = error.message;
			}

			toast({
				title: "Error",
				description: errorMessage,
				variant: "destructive",
				position: "bottom-center",
				duration: 3000,
			});
			throw error;
		}
	};

	const handleUpdateRecord = async (data: RecordData) => {
		if (!collectionName || !editingRecord) return;

		try {
			await recordsApi.update(collectionName, editingRecord.id, {
				data,
			});

			toast({
				title: "Success!",
				description: `Record has been updated successfully.`,
				variant: "success",
				position: "bottom-center",
				duration: 3000,
			});

			setIsEditSheetOpen(false);
			setEditingRecord(null);

			// Invalidate queries to refresh data
			queryClient.invalidateQueries({
				queryKey: ["collectionRecords", collectionName],
			});
		} catch (error) {
			console.error("Record update error:", error);

			let errorMessage = "Failed to update record";

			if (error instanceof CustomApiError) {
				errorMessage = error.message;
			} else if (error instanceof Error) {
				errorMessage = error.message;
			}

			toast({
				title: "Error",
				description: errorMessage,
				variant: "destructive",
				position: "bottom-center",
				duration: 3000,
			});
			throw error;
		}
	};

	const handleDeleteRecord = async (recordId: number) => {
		setRecordToDelete(recordId);
		setDeleteDialogOpen(true);
	};

	const confirmDeleteRecord = async () => {
		if (!recordToDelete || !collectionName) return;

		try {
			await recordsApi.delete(collectionName, recordToDelete);

			setDeleteDialogOpen(false);
			setRecordToDelete(null);

			toast({
				title: "Record deleted",
				description: "Record has been deleted successfully.",
				variant: "success",
				position: "bottom-center",
				duration: 3000,
			});

			// Invalidate queries to refresh data
			queryClient.invalidateQueries({
				queryKey: ["collectionRecords", collectionName],
			});
			queryClient.invalidateQueries({ queryKey: ["collections"] });
		} catch (error) {
			const errorMessage =
				error instanceof CustomApiError
					? error.message
					: "Failed to delete record";
			toast({
				title: "Error",
				description: errorMessage,
				variant: "destructive",
				position: "bottom-center",
				duration: 3000,
			});
			setDeleteDialogOpen(false);
			setRecordToDelete(null);
		}
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
				isSheetOpen={isSheetOpen}
				onSheetOpenChange={setIsSheetOpen}
				onCreateRecord={handleCreateRecord}
			/>

			{/* Records Table */}
			{records.length > 0 || isLoading ? (
				<div className="space-y-4">
					<Table<ApiRecord>
						columns={[
							{
								key: "id",
								title: "ID",
								className: "w-16",
								render: (
									_value: unknown,
									record: ApiRecord,
									_index: number,
								) => <div className="font-medium">{record.id}</div>,
							},
							{
								key: "data",
								title: "Data",
								render: (
									_value: unknown,
									record: ApiRecord,
									_index: number,
								) => (
									<div className="flex gap-4">
										{Object.entries(record.data)
											.slice(1, 3)
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
										{Object.keys(record.data).length > 3 && (
											<div className="text-xs text-nocta-500 dark:text-nocta-500 mt-1">
												+{Object.keys(record.data).length - 3} more fields
											</div>
										)}
									</div>
								),
							},
							{
								key: "created_at",
								title: "Created",
								className: "w-32",
								render: (
									_value: unknown,
									record: ApiRecord,
									_index: number,
								) => (
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
								render: (
									_value: unknown,
									record: ApiRecord,
									_index: number,
								) => (
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
					onAddRecord={() => setIsSheetOpen(true)}
				/>
			)}

			<CollectionRecordsEditSheet
				open={isEditSheetOpen}
				onOpenChange={setIsEditSheetOpen}
				record={editingRecord}
				collection={collection}
				onSubmit={handleUpdateRecord}
			/>

			<DeleteRecordDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onConfirm={confirmDeleteRecord}
				onCancel={() => {
					setDeleteDialogOpen(false);
					setRecordToDelete(null);
				}}
			/>
		</div>
	);
}

export const Route = createFileRoute("/records/$collection")({
	component: RecordComponent,
});
