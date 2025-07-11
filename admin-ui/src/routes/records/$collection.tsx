import { useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useParams,
} from "@tanstack/react-router";
import {
	ArrowLeft,
	Braces,
	Calendar,
	Database,
	Edit3,
	FileText,
	Hash,
	Link as LinkIcon,
	Mail,
	Plus,
	Save,
	Search,
	ToggleLeft,
	Trash2,
	Type,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Table } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useCollectionRecordsQuery } from "@/hooks/useCollectionRecordsQuery";
import { useDebounce } from "@/hooks/useDebounce";
import { CustomApiError, collectionsApi, recordsApi } from "@/lib/api";
import type {
	ApiRecord,
	Collection,
	CreateRecordRequest,
	FieldDefinition,
	RecordData,
} from "@/types/api";

// Use ApiRecord instead of Record to avoid conflict with TypeScript's built-in Record type
type Record = ApiRecord;

const fieldTypeIcons = {
	text: Type,
	number: Hash,
	boolean: ToggleLeft,
	date: Calendar,
	email: Mail,
	url: LinkIcon,
	json: Braces,
	file: FileText,
	relation: Database,
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
	const [searchTerm, setSearchTerm] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const pageSize = 10;

	// Debounce search term
	const debouncedSearchTerm = useDebounce(searchTerm, 300);

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
	const [submitting, setSubmitting] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
	const [formData, setFormData] = useState<RecordData>({});

	// Edit sheet state
	const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
	const [editingRecord, setEditingRecord] = useState<Record | null>(null);
	const [editSubmitting, setEditSubmitting] = useState(false);
	const [editFieldErrors, setEditFieldErrors] = useState<{
		[key: string]: string;
	}>({});
	const [editFormData, setEditFormData] = useState<RecordData>({});

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

	useEffect(() => {
		if (isSheetOpen && collection) {
			initializeFormData();
			setFieldErrors({});
		}
	}, [isSheetOpen, collection]);

	useEffect(() => {
		if (isEditSheetOpen && editingRecord && collection) {
			initializeEditFormData();
			setEditFieldErrors({});
		}
	}, [isEditSheetOpen, editingRecord, collection]);

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

	const initializeFormData = () => {
		if (!collection) return;

		const initialData: RecordData = {};
		collection.schema?.fields?.forEach((field) => {
			if (field.name !== "id") {
				if (field.default_value !== null && field.default_value !== undefined) {
					initialData[field.name] = field.default_value;
				} else {
					switch (field.field_type) {
						case "boolean":
							initialData[field.name] = false;
							break;
						case "number":
							initialData[field.name] = "";
							break;
						default:
							initialData[field.name] = "";
					}
				}
			}
		});
		setFormData(initialData);
	};

	const updateFormData = (fieldName: string, value: any) => {
		setFormData((prev) => ({
			...prev,
			[fieldName]: value,
		}));
	};

	const initializeEditFormData = () => {
		if (!editingRecord || !collection) return;

		const initialData: RecordData = {};
		collection.schema?.fields?.forEach((field) => {
			if (field.name !== "id") {
				const value = editingRecord.data[field.name];
				if (value !== null && value !== undefined) {
					initialData[field.name] =
						field.field_type === "json" && typeof value === "object"
							? JSON.stringify(value, null, 2)
							: value;
				} else {
					switch (field.field_type) {
						case "boolean":
							initialData[field.name] = false;
							break;
						case "number":
							initialData[field.name] = "";
							break;
						default:
							initialData[field.name] = "";
					}
				}
			}
		});
		setEditFormData(initialData);
	};

	const updateEditFormData = (fieldName: string, value: any) => {
		setEditFormData((prev) => ({
			...prev,
			[fieldName]: value,
		}));
	};

	const handleEditRecord = (record: Record) => {
		setEditingRecord(record);
		setIsEditSheetOpen(true);
	};

	const validateForm = (): boolean => {
		if (!collection) return false;

		const newErrors: { [key: string]: string } = {};

		collection.schema?.fields?.forEach((field) => {
			if (field.name === "id") return;

			const value = formData[field.name];

			if (
				field.required &&
				(value === "" || value === null || value === undefined)
			) {
				newErrors[field.name] = `${field.name} is required`;
				return;
			}

			if (
				!field.required &&
				(value === "" || value === null || value === undefined)
			) {
				return;
			}

			switch (field.field_type) {
				case "email":
					if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
						newErrors[field.name] = "Please enter a valid email address";
					}
					break;
				case "url":
					if (value && !/^https?:\/\/.+/.test(value)) {
						newErrors[field.name] =
							"Please enter a valid URL (starting with http:// or https://)";
					}
					break;
				case "number":
					if (value && isNaN(Number(value))) {
						newErrors[field.name] = "Please enter a valid number";
					}
					break;
				case "json":
					if (value) {
						try {
							JSON.parse(value);
						} catch {
							newErrors[field.name] = "Please enter valid JSON";
						}
					}
					break;
			}
		});

		setFieldErrors(newErrors);

		if (Object.keys(newErrors).length > 0) {
			toast({
				title: "Validation Error",
				description: "Please fix the validation errors below",
				variant: "destructive",
				position: "bottom-center",
				duration: 3000,
			});
		}

		return Object.keys(newErrors).length === 0;
	};

	const validateEditForm = (): boolean => {
		if (!collection) return false;

		const newErrors: { [key: string]: string } = {};

		collection.schema?.fields?.forEach((field) => {
			if (field.name === "id") return;

			const value = editFormData[field.name];

			if (
				field.required &&
				(value === "" || value === null || value === undefined)
			) {
				newErrors[field.name] = `${field.name} is required`;
				return;
			}

			if (
				!field.required &&
				(value === "" || value === null || value === undefined)
			) {
				return;
			}

			switch (field.field_type) {
				case "email":
					if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
						newErrors[field.name] = "Please enter a valid email address";
					}
					break;
				case "url":
					if (value && !/^https?:\/\/.+/.test(value)) {
						newErrors[field.name] =
							"Please enter a valid URL (starting with http:// or https://)";
					}
					break;
				case "number":
					if (value && isNaN(Number(value))) {
						newErrors[field.name] = "Please enter a valid number";
					}
					break;
				case "json":
					if (value) {
						try {
							JSON.parse(value);
						} catch {
							newErrors[field.name] = "Please enter valid JSON";
						}
					}
					break;
			}
		});

		setEditFieldErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleCreateRecord = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm() || !collection || !collectionName) return;

		setSubmitting(true);

		try {
			const submitData: RecordData = {};

			const fieldsToProcess =
				collection.schema?.fields?.filter((field) => field.name !== "id") || [];

			fieldsToProcess.forEach((field) => {
				let value = formData[field.name];

				switch (field.field_type) {
					case "number":
						if (value !== "" && value !== null && value !== undefined) {
							value = Number(value);
						} else if (!field.required) {
							value = null;
						}
						break;
					case "boolean":
						value = Boolean(value);
						break;
					case "json":
						if (value && typeof value === "string") {
							try {
								value = JSON.parse(value);
							} catch {
								// Keep as string if parsing fails
							}
						}
						break;
					default:
						if (!field.required && value === "") {
							value = null;
						}
				}

				submitData[field.name] = value;
			});

			const request: CreateRecordRequest = {
				data: submitData,
			};

			await recordsApi.create(collectionName, request);

			toast({
				title: "Success!",
				description: `Record has been created successfully.`,
				variant: "success",
				position: "bottom-center",
				duration: 3000,
			});

			setIsSheetOpen(false);
			initializeFormData();

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
		} finally {
			setSubmitting(false);
		}
	};

	const handleUpdateRecord = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateEditForm() || !collection || !collectionName || !editingRecord)
			return;

		setEditSubmitting(true);

		try {
			const submitData: RecordData = {};

			const fieldsToProcess =
				collection.schema?.fields?.filter((field) => field.name !== "id") || [];

			fieldsToProcess.forEach((field) => {
				let value = editFormData[field.name];

				switch (field.field_type) {
					case "number":
						if (value !== "" && value !== null && value !== undefined) {
							value = Number(value);
						} else if (!field.required) {
							value = null;
						}
						break;
					case "boolean":
						value = Boolean(value);
						break;
					case "json":
						if (value && typeof value === "string") {
							try {
								value = JSON.parse(value);
							} catch {
								// Keep as string if parsing fails
							}
						}
						break;
					default:
						if (!field.required && value === "") {
							value = null;
						}
				}

				submitData[field.name] = value;
			});

			await recordsApi.update(collectionName, editingRecord.id, {
				data: submitData,
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
		} finally {
			setEditSubmitting(false);
		}
	};

	const renderField = (field: FieldDefinition) => {
		if (field.name === "id") return null;

		const IconComponent = fieldTypeIcons[field.field_type];
		const value = formData[field.name] || "";
		const hasError = !!fieldErrors[field.name];

		return (
			<FormField
				key={field.name}
				name={field.name}
				error={fieldErrors[field.name]}
			>
				<FormLabel
					required={field.required}
					className="flex items-center gap-2"
				>
					<IconComponent className="w-4 h-4 text-nocta-600 dark:text-nocta-400" />
					{field.name}
				</FormLabel>
				<FormControl>
					{field.field_type === "boolean" ? (
						<div className="flex items-center space-x-2">
							<Checkbox
								checked={Boolean(value)}
								onCheckedChange={(checked) =>
									updateFormData(field.name, checked)
								}
							/>
							<span className="text-sm text-nocta-700 dark:text-nocta-300">
								{field.name}
							</span>
						</div>
					) : field.field_type === "json" ? (
						<Textarea
							placeholder={`Enter JSON data for ${field.name}`}
							value={
								typeof value === "string"
									? value
									: JSON.stringify(value, null, 2)
							}
							onChange={(e) => updateFormData(field.name, e.target.value)}
							className="w-full"
							variant={hasError ? "error" : "default"}
							rows={4}
						/>
					) : (
						<Input
							type={
								field.field_type === "number"
									? "number"
									: field.field_type === "email"
										? "email"
										: field.field_type === "url"
											? "url"
											: field.field_type === "date"
												? "date"
												: "text"
							}
							placeholder={`Enter ${field.name}`}
							value={value}
							className="w-full"
							onChange={(e) => updateFormData(field.name, e.target.value)}
							variant={hasError ? "error" : "default"}
						/>
					)}
				</FormControl>
				{field.default_value && (
					<FormDescription>
						Default: {String(field.default_value)}
					</FormDescription>
				)}
				<FormMessage />
			</FormField>
		);
	};

	const renderEditField = (field: FieldDefinition) => {
		if (field.name === "id") return null;

		const IconComponent = fieldTypeIcons[field.field_type];
		const value = editFormData[field.name] || "";
		const hasError = !!editFieldErrors[field.name];

		return (
			<FormField
				key={field.name}
				name={field.name}
				error={editFieldErrors[field.name]}
			>
				<FormLabel
					required={field.required}
					className="flex items-center gap-2"
				>
					<IconComponent className="w-4 h-4 text-nocta-600 dark:text-nocta-400" />
					{field.name}
				</FormLabel>
				<FormControl>
					{field.field_type === "boolean" ? (
						<div className="flex items-center space-x-2">
							<Checkbox
								checked={Boolean(value)}
								onCheckedChange={(checked) =>
									updateEditFormData(field.name, checked)
								}
							/>
							<span className="text-sm text-nocta-700 dark:text-nocta-300">
								{field.name}
							</span>
						</div>
					) : field.field_type === "json" ? (
						<Textarea
							placeholder={`Enter JSON data for ${field.name}`}
							value={
								typeof value === "string"
									? value
									: JSON.stringify(value, null, 2)
							}
							onChange={(e) => updateEditFormData(field.name, e.target.value)}
							className="w-full"
							variant={hasError ? "error" : "default"}
							rows={4}
						/>
					) : (
						<Input
							type={
								field.field_type === "number"
									? "number"
									: field.field_type === "email"
										? "email"
										: field.field_type === "url"
											? "url"
											: field.field_type === "date"
												? "date"
												: "text"
							}
							placeholder={`Enter ${field.name}`}
							value={value}
							className="w-full"
							onChange={(e) => updateEditFormData(field.name, e.target.value)}
							variant={hasError ? "error" : "default"}
						/>
					)}
				</FormControl>
				{field.default_value && (
					<FormDescription>
						Default: {String(field.default_value)}
					</FormDescription>
				)}
				<FormMessage />
			</FormField>
		);
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

	const cancelDeleteRecord = () => {
		setDeleteDialogOpen(false);
		setRecordToDelete(null);
	};

	const formatFieldValue = (value: any): string => {
		if (value === null || value === undefined) return "-";
		if (typeof value === "boolean") return value ? "Yes" : "No";
		if (typeof value === "object") return JSON.stringify(value);
		return String(value);
	};

	const handleSearchChange = (value: string) => {
		setSearchTerm(value);
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
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-4xl font-bold text-nocta-900 dark:text-nocta-100">
							{collection?.display_name || collectionName}
						</h1>
						<Badge variant="secondary" className="">
							{totalCount} records
						</Badge>
					</div>
					<p className="text-lg text-nocta-600 dark:text-nocta-400">
						{collection?.description ||
							`Manage records in the ${collectionName} collection`}
					</p>
				</div>
				<div className="flex items-center gap-3">
					<div className="relative max-w-md">
						<Input
							placeholder="Search records..."
							leftIcon={
								<Search className="w-4 h-4 text-nocta-400 dark:text-nocta-500" />
							}
							value={searchTerm}
							onChange={(e) => handleSearchChange(e.target.value)}
							className="pl-10"
						/>
					</div>
					<Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
						<SheetTrigger asChild>
							<Button>
								<Plus className="w-4 h-4 mr-2" />
								Add Record
							</Button>
						</SheetTrigger>
						<SheetContent side="right" size="md">
							<SheetHeader>
								<SheetTitle className="flex items-center gap-2">
									Create Record
								</SheetTitle>
								<SheetDescription>
									Add a new record to{" "}
									<span className="font-medium">{collection?.name}</span>{" "}
									collection
								</SheetDescription>
							</SheetHeader>

							<div className="flex-1 overflow-y-auto px-6 py-4">
								<Form onSubmit={handleCreateRecord}>
									<div className="space-y-6">
										{collection &&
										collection.schema?.fields?.filter(
											(field) => field.name !== "id",
										).length === 0 ? (
											<div className="text-center py-8">
												<Database className="w-12 h-12 mx-auto text-nocta-400 mb-4" />
												<h3 className="text-lg font-medium text-nocta-900 dark:text-nocta-100 mb-2">
													No fields to fill
												</h3>
												<p className="text-nocta-600 dark:text-nocta-400 mb-4">
													This collection only has an auto-generated ID field.
													No additional data is required.
												</p>
												<p className="text-sm text-nocta-500 dark:text-nocta-500">
													You can still create a record, or add more fields to
													this collection first.
												</p>
											</div>
										) : (
											collection?.schema.fields.map(renderField)
										)}
									</div>
								</Form>
							</div>

							<SheetFooter>
								<SheetClose asChild>
									<Button variant="ghost">Cancel</Button>
								</SheetClose>
								<Button
									type="submit"
									disabled={submitting}
									onClick={handleCreateRecord}
								>
									{submitting ? (
										<>
											<Spinner size="sm" className="mr-2" />
											Creating...
										</>
									) : (
										<>
											<Save className="w-4 h-4 mr-2" />
											Create Record
										</>
									)}
								</Button>
							</SheetFooter>
						</SheetContent>
					</Sheet>
				</div>
			</div>

			{/* Records Table */}
			{records.length > 0 || isLoading ? (
				<div className="space-y-4">
					<Table<ApiRecord>
						columns={[
							{
								key: "id",
								title: "ID",
								className: "w-16",
								render: (_value: unknown, record: ApiRecord, _index: number) => (
									<div className="font-medium">{record.id}</div>
								),
							},
							...(collection?.schema.fields.slice(1, 4).map((field) => ({
								key: field.name,
								title: field.name,
								render: (_value: unknown, record: ApiRecord, _index: number) => (
									<div>
										<div
											className="max-w-32 truncate"
											title={formatFieldValue(record.data[field.name])}
										>
											{formatFieldValue(record.data[field.name])}
										</div>
										<span className="text-xs text-nocta-500 dark:text-nocta-500">
											({field.field_type})
										</span>
									</div>
								),
							})) || []),
							...(collection?.schema.fields &&
							collection.schema.fields.length > 4
								? [
										{
											key: "more_fields",
											title: "More Fields",
											render: (
														_value: unknown,
														_record: ApiRecord,
														_index: number,
													) => (
												<div className="text-xs text-nocta-500 dark:text-nocta-500">
													+{(collection.schema?.fields?.length || 0) - 4} more
												</div>
											),
										},
									]
								: []),
							{
								key: "created_at",
								title: "Created",
								className: "w-32",
								render: (_value: unknown, record: ApiRecord, _index: number) => (
									<div className="text-sm text-nocta-600 dark:text-nocta-400">
										{new Date(record.created_at).toLocaleDateString()}
									</div>
								),
							},
							{
								key: "actions",
								title: "Actions",
								className: "w-24",
								align: "left",
								render: (_value: unknown, record: ApiRecord, _index: number) => (
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
				<Card>
					<CardContent className="py-12">
						<div className="text-center">
							<div className="p-3 rounded-full bg-nocta-100 dark:bg-nocta-800/30 w-fit mx-auto mb-4">
								<FileText className="w-8 h-8 text-nocta-400 dark:text-nocta-500" />
							</div>
							<h3 className="text-lg font-semibold text-nocta-900 dark:text-nocta-100 mb-2">
								{searchTerm ? "No records found" : "No records yet"}
							</h3>
							<p className="text-nocta-600 dark:text-nocta-400 mb-4 max-w-sm mx-auto">
								{searchTerm
									? `No records match "${searchTerm}". Try a different search term.`
									: `Start by adding your first record to the ${collectionName} collection.`}
							</p>
							{!searchTerm && (
								<Button onClick={() => setIsSheetOpen(true)}>
									<Plus className="w-4 h-4 mr-2" />
									Add Record
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Edit Record Sheet */}
			<Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
				<SheetContent side="right" size="md">
					<SheetHeader>
						<SheetTitle className="flex items-center gap-2">
							Edit Record
						</SheetTitle>
						<SheetDescription>
							Update record #{editingRecord?.id} in{" "}
							<span className="font-medium">{collection?.name}</span> collection
						</SheetDescription>
					</SheetHeader>

					<div className="flex-1 overflow-y-auto px-6 py-4">
						<Form onSubmit={handleUpdateRecord}>
							<div className="space-y-6">
								{collection &&
								collection.schema?.fields?.filter(
									(field) => field.name !== "id",
								).length === 0 ? (
									<div className="text-center py-8">
										<Database className="w-12 h-12 mx-auto text-nocta-400 mb-4" />
										<h3 className="text-lg font-medium text-nocta-900 dark:text-nocta-100 mb-2">
											No fields to edit
										</h3>
										<p className="text-nocta-600 dark:text-nocta-400 mb-4">
											This collection only has an auto-generated ID field. No
											additional data can be modified.
										</p>
									</div>
								) : (
									collection?.schema.fields.map(renderEditField)
								)}
							</div>
						</Form>
					</div>

					<SheetFooter>
						<SheetClose asChild>
							<Button variant="ghost">Cancel</Button>
						</SheetClose>
						<Button
							type="submit"
							disabled={editSubmitting}
							onClick={handleUpdateRecord}
						>
							{editSubmitting ? (
								<>
									<Spinner size="sm" className="mr-2" />
									Updating...
								</>
							) : (
								<>
									<Save className="w-4 h-4 mr-2" />
									Update Record
								</>
							)}
						</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>

			{/* Delete Confirmation Dialog */}
			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent size="sm">
					<DialogHeader>
						<DialogTitle>Delete Record</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete this record? This action cannot be
							undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogActions>
							<DialogClose asChild>
								<Button variant="ghost" onClick={cancelDeleteRecord}>
									Cancel
								</Button>
							</DialogClose>
							<Button variant="primary" onClick={confirmDeleteRecord}>
								Delete
							</Button>
						</DialogActions>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export const Route = createFileRoute("/records/$collection")({
	component: RecordComponent,
});
