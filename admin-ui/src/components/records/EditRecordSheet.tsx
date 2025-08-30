import { FloppyDiskIcon } from "@phosphor-icons/react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUpload, type FileUploadFile } from "@/components/ui/file-upload";
import {
	Form,
	FormControl,
	FormField,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { JsonEditor } from "@/components/ui/json-editor";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { useCollections } from "@/hooks";
import type {
	Collection,
	FieldDefinition,
	Record,
	RecordData,
} from "@/types/api";
import {
	fieldTypeIcons,
	getDefaultFieldValue,
	processFieldValue,
	recordToastMessages,
} from "./constants";
import { validateRecordData } from "@/components/records/validation";
import { RichTextEditor } from "@/components/records/RichTextEditor";
import { type JSONContent } from "@tiptap/react";

interface RecordWithCollection extends Record {
	collection_name: string;
}

interface EditRecordSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	record: RecordWithCollection | null;
	collection: Collection | null;
	onSubmit: (data: RecordData) => Promise<void>;
}

export function EditRecordSheet({
	open,
	onOpenChange,
	record,
	collection,
	onSubmit,
}: EditRecordSheetProps) {
	const { data: collectionsData } = useCollections();
	const [submitting, setSubmitting] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
	const [formData, setFormData] = useState<RecordData>({});
	const [fileData, setFileData] = useState<{ [key: string]: FileUploadFile[] }>(
		{},
	);

	const availableCollections = collectionsData?.collections || [];

	const initializeFormData = useCallback(() => {
		if (!record || !collection) return;

		const initialData: RecordData = {};
		const initialFileData: { [key: string]: FileUploadFile[] } = {};

		collection.schema?.fields?.forEach((field) => {
			if (field.name !== "id") {
				const value = record.data[field.name];

				if (field.field_type === "file") {
					if (value && typeof value === "string") {
						const fileName = value.split("/").pop() || "file";
						initialFileData[field.name] = [
							{
								id: `existing-${Date.now()}`,
								file: new File([], fileName),
								preview: value,
								status: "success" as const,
							},
						];
					} else if (Array.isArray(value)) {
						initialFileData[field.name] = value.map((url, index) => {
							const fileName = url.split("/").pop() || `file-${index}`;
							return {
								id: `existing-${Date.now()}-${index}`,
								file: new File([], fileName),
								preview: url,
								status: "success" as const,
							};
						});
					} else {
						initialFileData[field.name] = [];
					}
				} else {
					if (value !== null && value !== undefined) {
						initialData[field.name] =
							field.field_type === "json" && typeof value === "object"
								? JSON.stringify(value, null, 2)
								: value;
					} else {
						initialData[field.name] = getDefaultFieldValue(field.field_type);
					}
				}
			}
		});

		setFormData(initialData);
		setFileData(initialFileData);
	}, [record, collection]);

	useEffect(() => {
		if (open && record && collection) {
			initializeFormData();
			setFieldErrors({});
		}
	}, [open, record, collection, initializeFormData]);

	const updateFormData = (
		fieldName: string,
		value: unknown,
	) => {
		setFormData((prev) => ({
			...prev,
			[fieldName]: value,
		}));
	};

	const updateFileData = (fieldName: string, files: FileUploadFile[]) => {
		setFileData((prev) => ({
			...prev,
			[fieldName]: files,
		}));
	};

	const validateForm = (): boolean => {
		if (!collection) return false;

		const dataToValidate = { ...formData };
		Object.keys(fileData).forEach(fieldName => {
			dataToValidate[fieldName] = fileData[fieldName];
		});

		const result = validateRecordData(collection.schema.fields, dataToValidate);
		
		if (!result.success) {
			const newErrors: { [key: string]: string } = {};
			result.errors.forEach(error => {
				const fieldMatch = error.match(/Field '([^']+)'/);
				if (fieldMatch) {
					newErrors[fieldMatch[1]] = error;
				} else {
					newErrors['_general'] = error;
				}
			});
			
			setFieldErrors(newErrors);
			toast({
				...recordToastMessages.validationError,
				variant: "destructive",
				position: "bottom-right",
				duration: 3000,
			});
			return false;
		}

		return true;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm() || !collection || !record) return;

		setSubmitting(true);

		try {
			const submitData: RecordData = {};

			const fieldsToProcess =
				collection.schema?.fields?.filter((field) => field.name !== "id") || [];

			fieldsToProcess.forEach((field) => {
				if (field.field_type === "file") {
					const files = fileData[field.name] || [];
					const processedValue = processFieldValue(
						field.field_type,
						files,
						field.required,
					);
					submitData[field.name] = processedValue;
				} else {
					const value = formData[field.name];
					submitData[field.name] = processFieldValue(
						field.field_type,
						value,
						field.required,
					);
				}
			});

			await onSubmit(submitData);
			onOpenChange(false);
		} catch (error) {
			console.error("Record update error:", error);
		} finally {
			setSubmitting(false);
		}
	};

	const renderField = (field: FieldDefinition) => {
		if (field.name === "id") return null;

		const IconComponent = fieldTypeIcons[field.field_type];
		const value = formData[field.name] ?? "";
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
						<JsonEditor
							placeholder={`Enter JSON data for ${field.name}`}
							value={
								typeof value === "string"
									? value
									: JSON.stringify(value, null, 2)
							}
							onChange={(newValue) => updateFormData(field.name, newValue)}
							variant={hasError ? "error" : "default"}
							rows={4}
						/>
					) : field.field_type === "richtext" ? (
						<RichTextEditor
							value={typeof value === 'object' ? (value as JSONContent) : { type: 'doc', content: [] }}
							onChange={(newContent) => updateFormData(field.name, newContent)}
						/>
					) : field.field_type === "relation" ? (
						<Select
							value={
								typeof value === "string" || typeof value === "number"
									? String(value)
									: ""
							}
							onValueChange={(selectedValue) =>
								updateFormData(field.name, selectedValue)
							}
						>
							<SelectTrigger
								className={`w-full ${hasError ? "border-red-500" : ""}`}
							>
								<SelectValue placeholder={`Select ${field.name}`} />
							</SelectTrigger>
							<SelectContent>
								{availableCollections.map((col) => (
									<SelectItem key={col.id} value={col.id.toString()}>
										{col.display_name || col.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					) : field.field_type === "file" ? (
						<FileUpload
							multiple={false}
							accept="*/*"
							maxSize={10 * 1024 * 1024}
							maxFiles={2}
							files={fileData[field.name] || []}
							onFilesChange={(files) => updateFileData(field.name, files)}
							uploadText={`Click to upload files for ${field.name}`}
							dragText={`Drop files here for ${field.name}`}
							size="sm"
							showPreview={false}
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
							value={
								typeof value === "string" || typeof value === "number"
									? String(value)
									: ""
							}
							className="w-full"
							onChange={(e) => updateFormData(field.name, e.target.value)}
							variant={hasError ? "error" : "default"}
						/>
					)}
				</FormControl>
				<FormMessage />
			</FormField>
		);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent size="xl">
				<SheetHeader>
					<SheetTitle>Edit Record</SheetTitle>
					<SheetDescription>
						Update the record data below. All changes will be saved to the
						database.
					</SheetDescription>
				</SheetHeader>

				<Form onSubmit={handleSubmit} className="space-y-6">
					<div className="space-y-4 px-6 py-4">
						{collection &&
						collection.schema?.fields?.filter((field) => field.name !== "id")
							.length > 0 ? (
							collection.schema?.fields?.map((field) => renderField(field))
						) : (
							<p className="text-sm text-nocta-500 dark:text-nocta-400">
								No editable fields available for this collection.
							</p>
						)}
					</div>

					<SheetFooter className="absolute w-full bottom-0">
						<SheetClose asChild>
							<Button type="button" variant="ghost">
								Cancel
							</Button>
						</SheetClose>
						<Button
							type="submit"
							disabled={submitting}
							className="flex items-center gap-2"
						>
							{submitting ? (
								<>
									<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
									Updating...
								</>
							) : (
							<>
								<FloppyDiskIcon size={16} />
								Update Record
							</>
						)}
						</Button>
					</SheetFooter>
				</Form>
			</SheetContent>
		</Sheet>
	);
}
