import { PencilIcon, TrashIcon, UserIcon } from "@phosphor-icons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { OwnershipBadge, TransferOwnership } from "@/components/ownership";
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
import { toast } from "@/components/ui/toast";

import {
	useAllRecords,
	useCollections,
	useDebounce,
	useDeleteRecord,
	useUpdateRecord,
} from "@/hooks/";
import { CustomApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-persist.store";
import { useUI, useUIActions } from "@/stores/client.store";
import type { Collection, RecordData, RecordWithCollection } from "@/types/api";

export default function RecordsComponent() {
	const { user } = useAuthStore();
	const { data: collectionsData } = useCollections();
	const collections = useMemo(
		() => collectionsData?.collections || [],
		[collectionsData?.collections],
	);

	const [localSearchTerm, setLocalSearchTerm] = useState("");
	const searchTerm = useDebounce(localSearchTerm, 300);
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize] = useState(20);

	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm]);

	const { modals, sheets } = useUI();
	const { openModal, closeModal, openSheet, closeSheet } = useUIActions();

	const { data, isLoading, error, refetch } = useAllRecords({
		currentPage,
		pageSize,
		searchTerm,
	});

	const [recordToDelete, setRecordToDelete] = useState<{
		collectionName: string;
		recordId: number;
	} | null>(null);

	const [editingRecord, setEditingRecord] =
		useState<RecordWithCollection | null>(null);
	const [editingCollection, setEditingCollection] = useState<Collection | null>(
		null,
	);

	const deleteRecordMutation = useDeleteRecord();
	const updateRecordMutation = useUpdateRecord();

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
				position: "bottom-right",
				duration: 3000,
			});
		}
	}, [error]);

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

					refetch();
				},
				onError: (error) => {
					closeSheet("editRecord");
					throw error;
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

	const allRecords = data?.records || [];
	const totalRecords = data?.pagination.total_count || 0;

	const columns: TableColumn<RecordWithCollection>[] = [
		{
			key: "id",
			title: "ID",
			className: "w-16",
			render: (_, record) => (
				<div className="text-sm text-nocta-600 dark:text-nocta-400">
					{record.id}
				</div>
			),
		},
		{
			key: "collection_name",
			title: "Collection",
			className: "w-32",
			render: (_, record) => (
				<Link to={`/collections`}>
					<Badge
						size="sm"
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
			render: (_, record) => {
				const excludedFields = [
					"id",
					"owner_id",
					"author_id",
					"created_by",
					"user_id",
				];
				const filteredEntries = Object.entries(record.data).filter(
					([key]) => !excludedFields.includes(key),
				);

				return (
					<div className="flex gap-4">
						{filteredEntries.slice(0, 1).map(([key, value]) => (
							<div key={key} className="text-sm">
								<span className="font-light text-nocta-700 dark:text-nocta-300">
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
			render: (_, record) => {
				const getUserId = (value: unknown): number | undefined => {
					if (typeof value === "number") return value;
					if (typeof value === "string") {
						const parsed = parseInt(value, 10);
						return isNaN(parsed) ? undefined : parsed;
					}
					return undefined;
				};

				return (
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
				);
			},
		},
		{
			key: "created_at",
			title: "Created",
			className: "w-32",
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
			render: (_, record) => {
				const getUserId = (value: unknown): number | undefined => {
					if (typeof value === "number") return value;
					if (typeof value === "string") {
						const parsed = parseInt(value, 10);
						return isNaN(parsed) ? undefined : parsed;
					}
					return undefined;
				};

				const currentOwnerId =
					getUserId(record.data.owner_id) ||
					getUserId(record.data.user_id) ||
					getUserId(record.data.created_by) ||
					getUserId(record.data.author_id);

				return (
					<div className="flex items-center gap-1">
						<TransferOwnership
							collectionName={record.collection_name}
							recordId={record.id}
							currentOwnerId={currentOwnerId}
							onSuccess={() => refetch()}
							trigger={
								<Button
									variant="ghost"
									size="sm"
									className="w-8 h-8 p-0"
									title="Transfer ownership"
								>
									<UserIcon size={16} />
								</Button>
							}
						/>
						<Button
							variant="ghost"
							size="sm"
							className="w-8 h-8 p-0"
							onClick={() => handleEditRecord(record)}
							title="Edit record"
						>
							<PencilIcon size={16} />
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
							<TrashIcon size={16} />
						</Button>
					</div>
				);
			},
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

			{allRecords.length > 0 || isLoading ? (
				<div className="space-y-4">
					<div className="overflow-x-auto">
						<Table<RecordWithCollection>
							columns={columns}
							data={allRecords}
							loading={isLoading}
							pagination={{
								current: currentPage,
								pageSize: pageSize,
								total: totalRecords,
								onChange: handlePageChange,
							}}
						/>
					</div>
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

			<DeleteRecordDialog
				open={modals.deleteRecord || false}
				onOpenChange={(open) =>
					open ? openModal("deleteRecord") : closeModal("deleteRecord")
				}
				onConfirm={confirmDeleteRecord}
				onCancel={cancelDeleteRecord}
			/>

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
