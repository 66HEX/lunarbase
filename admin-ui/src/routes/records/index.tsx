import { createFileRoute, Link } from "@tanstack/react-router";
import { Edit3, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	DeleteRecordDialog,
	EditRecordSheet,
	EmptyRecordsState,
	RecordsHeader,
} from "@/components/records";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { TableColumn } from "@/components/ui/table";
import { Table } from "@/components/ui/table";
import {
	useDeleteRecord,
	useUpdateRecord,
} from "@/hooks/records/useRecordMutations";
import { useAllRecordsQuery } from "@/hooks/useAllRecordsQuery";
import { useCollectionsQuery } from "@/hooks/useCollectionsQuery";
import { useToast } from "@/hooks/useToast";
import { CustomApiError } from "@/lib/api";
import { useUI, useUIActions } from "@/stores/client.store";
import type { Collection, RecordData, RecordWithCollection } from "@/types/api";

export default function RecordsComponent() {
	// Use stores and hooks
	const { data: collectionsData } = useCollectionsQuery();
	const collections = useMemo(
		() => collectionsData?.collections || [],
		[collectionsData?.collections],
	);

	// Local state for pagination and search (replacing useRecords store)
	const [searchTerm, setSearchTerm] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize] = useState(20);

	const { modals, sheets } = useUI();
	const { openModal, closeModal, openSheet, closeSheet } = useUIActions();

	const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
	const { data, isLoading, error, refetch } = useAllRecordsQuery({
		currentPage,
		pageSize,
		searchTerm,
	});

	const [recordToDelete, setRecordToDelete] = useState<{
		collectionName: string;
		recordId: number;
	} | null>(null);

	// Edit sheet state
	const [editingRecord, setEditingRecord] =
		useState<RecordWithCollection | null>(null);
	const [editingCollection, setEditingCollection] = useState<Collection | null>(
		null,
	);

	const { toast } = useToast();

	// React Query mutations
	const deleteRecordMutation = useDeleteRecord();
	const updateRecordMutation = useUpdateRecord();

	useEffect(() => {
		setLocalSearchTerm(searchTerm);
	}, [searchTerm]);

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
		if (sheets.editRecord && editingRecord) {
			const collection = collections.find(
				(c) => c.name === editingRecord.collection_name,
			);
			if (collection) {
				setEditingCollection(collection);
			}
		}
	}, [sheets.editRecord, editingRecord, collections]);

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
		openModal("deleteRecord");
	};

	const confirmDeleteRecord = async () => {
		if (!recordToDelete) return;

		deleteRecordMutation.mutate(
			{
				collectionName: recordToDelete.collectionName,
				recordId: recordToDelete.recordId,
			},
			{
				onSuccess: () => {
					closeModal("deleteRecord");
					setRecordToDelete(null);
					// Refetch data to update the list
					refetch();
				},
				onError: () => {
					closeModal("deleteRecord");
					setRecordToDelete(null);
				},
			},
		);
	};

	const cancelDeleteRecord = () => {
		closeModal("deleteRecord");
		setRecordToDelete(null);
	};

	const handleEditRecord = (record: RecordWithCollection) => {
		setEditingRecord(record);
		openSheet("editRecord");
	};

	const handleUpdateRecord = async (data: RecordData) => {
		if (!editingRecord) return;

		updateRecordMutation.mutate(
			{
				collectionName: editingRecord.collection_name,
				recordId: editingRecord.id,
				data: { data },
			},
			{
				onSuccess: () => {
					setEditingRecord(null);
					setEditingCollection(null);
					closeSheet("editRecord");
					// Refetch data to update the list
					refetch();
				},
				onError: (error) => {
					closeSheet("editRecord");
					throw error; // Re-throw to let EditRecordSheet handle it
				},
			},
		);
	};

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

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
			<RecordsHeader
				totalRecords={totalRecords}
				searchTerm={localSearchTerm}
				onSearchChange={(value) => setLocalSearchTerm(value)}
			/>

			{/* Records Table */}
			{allRecords.length > 0 || isLoading ? (
				<div className="space-y-4">
					<div className="overflow-x-auto">
						<Table<RecordWithCollection>
							columns={columns}
							data={allRecords}
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
				open={modals.deleteRecord || false}
				onOpenChange={(open) =>
					open ? openModal("deleteRecord") : closeModal("deleteRecord")
				}
				onConfirm={confirmDeleteRecord}
				onCancel={cancelDeleteRecord}
			/>

			{/* Edit Record Sheet */}
			<EditRecordSheet
				open={sheets.editRecord || false}
				onOpenChange={(open) =>
					open ? openSheet("editRecord") : closeSheet("editRecord")
				}
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
