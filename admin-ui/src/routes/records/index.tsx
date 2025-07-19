import { createFileRoute, Link } from "@tanstack/react-router";
import { Edit3, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
	DeleteRecordDialog,
	EditRecordSheet,
	EmptyRecordsState,
} from "@/components/records";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { TableColumn } from "@/components/ui/table";
import { Table } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useAllRecordsQuery } from "@/hooks/useAllRecordsQuery";
import { CustomApiError } from "@/lib/api";
import { useCollections, useRecords } from "@/stores";
import type { Collection, RecordData, RecordWithCollection } from "@/types/api";

export default function RecordsComponent() {
	// Use stores and hooks
	const { collections, fetchCollections } = useCollections();
	const { searchTerm, currentPage, pageSize, setSearchTerm, setCurrentPage } =
		useRecords();

	const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
	const { data, isLoading, error, refetch } = useAllRecordsQuery({
		currentPage,
		pageSize,
		searchTerm,
	});

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [recordToDelete, setRecordToDelete] = useState<{
		collectionName: string;
		recordId: number;
	} | null>(null);

	// Edit sheet state
	const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
	const [editingRecord, setEditingRecord] =
		useState<RecordWithCollection | null>(null);
	const [editingCollection, setEditingCollection] = useState<Collection | null>(
		null,
	);

	const { toast } = useToast();

	useEffect(() => {
		setLocalSearchTerm(searchTerm);
	}, [searchTerm]);

	useEffect(() => {
		fetchCollections().catch((error) => {
			const errorMessage =
				error instanceof CustomApiError
					? error.message
					: "Failed to fetch collections";
			toast({
				title: "Error",
				description: errorMessage,
				variant: "destructive",
				position: "bottom-center",
				duration: 3000,
			});
		});
	}, []);

	useEffect(() => {
		const timeoutId = setTimeout(() => {
			if (localSearchTerm !== searchTerm) {
				setSearchTerm(localSearchTerm);
				setCurrentPage(1); // Reset to first page when searching
			}
		}, 300); // 300ms debounce

		return () => clearTimeout(timeoutId);
	}, [localSearchTerm, searchTerm, setSearchTerm, setCurrentPage]);

	useEffect(() => {
		if (isEditSheetOpen && editingRecord) {
			const collection = collections.find(
				(c) => c.name === editingRecord.collection_name,
			);
			if (collection) {
				setEditingCollection(collection);
			}
		}
	}, [isEditSheetOpen, editingRecord, collections]);

	// Handle query error
	useEffect(() => {
		if (error) {
			const errorMessage =
				error instanceof CustomApiError
					? error.message
					: "Failed to fetch records";
			toast({
				title: "Error",
				description: errorMessage,
				variant: "destructive",
				position: "bottom-center",
				duration: 3000,
			});
		}
	}, [error, toast]);

	const handleDeleteRecord = async (
		collectionName: string,
		recordId: number,
	) => {
		setRecordToDelete({ collectionName, recordId });
		setDeleteDialogOpen(true);
	};

	const confirmDeleteRecord = async () => {
		if (!recordToDelete) return;

		try {
			const { recordsApi } = await import("@/lib/api");
			await recordsApi.delete(
				recordToDelete.collectionName,
				recordToDelete.recordId,
			);
			setDeleteDialogOpen(false);
			setRecordToDelete(null);

			// Refetch data to update the list
			refetch();

			toast({
				title: "Record deleted",
				description: "Record has been deleted successfully.",
				variant: "success",
				position: "bottom-center",
				duration: 3000,
			});
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

	const cancelDeleteRecord = () => {
		setDeleteDialogOpen(false);
		setRecordToDelete(null);
	};

	const handleEditRecord = (record: RecordWithCollection) => {
		setEditingRecord(record);
		setIsEditSheetOpen(true);
	};

	const handleUpdateRecord = async (data: RecordData) => {
		if (!editingRecord) return;

		try {
			const { recordsApi } = await import("@/lib/api");
			await recordsApi.update(editingRecord.collection_name, editingRecord.id, {
				data,
			});

			toast({
				title: "Success!",
				description: `Record has been updated successfully.`,
				variant: "success",
				position: "bottom-center",
				duration: 1000,
			});

			setEditingRecord(null);
			setEditingCollection(null);

			// Refetch data to update the list
			refetch();
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
				duration: 1000,
			});

			throw error; // Re-throw to let EditRecordSheet handle it
		}
	};

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

	const handleSearchChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setLocalSearchTerm(e.target.value);
		},
		[],
	);

	const formatFieldValue = (value: any): string => {
		if (value === null || value === undefined) return "-";
		if (typeof value === "boolean") return value ? "Yes" : "No";
		if (typeof value === "object") return JSON.stringify(value);
		return String(value);
	};

	// Get records from query
	const allRecords = data?.records || [];
	const totalRecords = data?.pagination.total_count || 0;

	const columns: TableColumn<RecordWithCollection>[] = [
		{
			key: "id",
			title: "ID",
			render: (_, record) => (
				<div className="text-sm font-mono text-nocta-600 dark:text-nocta-400">
					{record.id}
				</div>
			),
		},
		{
			key: "collection_name",
			title: "Collection",
			render: (_, record) => (
				<Link to={`/collections`}>
					<Badge
						variant="secondary"
						className="cursor-pointer hover:bg-nocta-200 dark:hover:bg-nocta-700"
					>
						{record.collection_name}
					</Badge>
				</Link>
			),
		},
		{
			key: "data",
			title: "Data",
			render: (_, record) => (
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
			render: (_, record) => (
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
			align: "left",
			className: "w-24",
			render: (_, record) => (
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
						onClick={() =>
							handleDeleteRecord(record.collection_name, record.id)
						}
						title="Delete record"
					>
						<Trash2 className="w-4 h-4" />
					</Button>
				</div>
			),
		},
	];

	if (isLoading && !data) {
		return (
			<div className="flex items-center justify-center h-svh">
				<div className="text-center">
					<Spinner className="w-8 h-8 mx-auto mb-4" />
					<p className="text-nocta-600 dark:text-nocta-400">
						Loading records...
					</p>
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
							All Records
						</h1>
						<Badge
							variant="secondary"
							className="px-2 py-0.5 text-xs font-medium"
						>
							{totalRecords} records
						</Badge>
					</div>
					<p className="text-lg text-nocta-600 dark:text-nocta-400">
						Browse and manage all records across collections
					</p>
				</div>
				<div className="flex items-center gap-3">
					<div className="relative max-w-md">
						<Input
							placeholder="Search records..."
							leftIcon={
								<Search className="w-4 h-4 text-nocta-400 dark:text-nocta-500" />
							}
							value={localSearchTerm}
							onChange={handleSearchChange}
							className="pl-10"
						/>
					</div>
				</div>
			</div>

			{/* Records Table */}
			{allRecords.length > 0 || isLoading ? (
				<div className="space-y-4">
					<div className="overflow-x-auto">
						<Table
							columns={columns as any}
							data={allRecords as any}
							loading={isLoading} // Show spinner on loading
							pagination={{
								current: currentPage,
								pageSize: pageSize,
								total: totalRecords,
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
				<EmptyRecordsState searchTerm={searchTerm} />
			)}

			{/* Delete Confirmation Dialog */}
			<DeleteRecordDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onConfirm={confirmDeleteRecord}
				onCancel={cancelDeleteRecord}
			/>

			{/* Edit Record Sheet */}
			<EditRecordSheet
				open={isEditSheetOpen}
				onOpenChange={setIsEditSheetOpen}
				record={editingRecord}
				collection={editingCollection}
				onSubmit={handleUpdateRecord}
			/>
		</div>
	);
}

export const Route = createFileRoute("/records/")({
	component: RecordsComponent,
});
