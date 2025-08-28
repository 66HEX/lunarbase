import { Database, Plus, Save } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUpload, type FileUploadFile } from "@/components/ui/file-upload";
import { Form, FormControl, FormField, FormLabel } from "@/components/ui/form";
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
	SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { useCollections } from "@/hooks";
import type { Collection, FieldDefinition, RecordData } from "@/types/api";
import {
	fieldTypeIcons,
	getDefaultFieldValue,
	processFieldValue,
	recordToastMessages,
	validateFieldValue,
} from "./constants";

interface CreateRecordSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	collection: Collection | null;
	onSubmit: (data: RecordData) => Promise<void>;
}

export function CreateRecordSheet({
	open,
	onOpenChange,
	collection,
	onSubmit,
}: CreateRecordSheetProps) {
	const [submitting, setSubmitting] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
	const [formData, setFormData] = useState<RecordData>({});
	const [fileData, setFileData] = useState<{ [key: string]: FileUploadFile[] }>(
		{},
	);
	const { data: collectionsData } = useCollections();

	const availableCollections = collectionsData?.collections || [];

	const initializeFormData = useCallback(() => {
		if (!collection) return;

		const initialData: RecordData = {};
		collection.schema?.fields?.forEach((field) => {
			if (field.name !== "id") {
				initialData[field.name] = getDefaultFieldValue(
					field.field_type,
					field.default_value,
				);
			}
		});
		setFormData(initialData);
	}, [collection]);

	useEffect(() => {
		if (open && collection) {
			initializeFormData();
			setFieldErrors({});
			setFileData({});
		}
	}, [open, collection, initializeFormData]);

	const updateFormData = (
		fieldName: string,
		value: string | number | boolean | null,
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

		const newErrors: { [key: string]: string } = {};

		collection.schema?.fields?.forEach((field) => {
			if (field.name === "id") return;

			const value =
				field.field_type === "file"
					? fileData[field.name]
					: formData[field.name];
			const error = validateFieldValue(field, value);
			if (error) {
				newErrors[field.name] = error;
			}
		});

		setFieldErrors(newErrors);

		if (Object.keys(newErrors).length > 0) {
			toast(recordToastMessages.validationError);
		}

		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!validateForm() || !collection) return;

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
			initializeFormData();
			setFileData({});
		} catch (error) {
			console.error("Record creation error:", error);
		} finally {
			setSubmitting(false);
		}
	};

	const renderField = (field: FieldDefinition) => {
		if (field.name === "id") return null;

		const IconComponent = fieldTypeIcons[field.field_type];
		const value = formData[field.name];
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
					) : field.field_type === "relation" ? (
						<Select
							value={typeof value === "string" ? value : ""}
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
							multiple={true}
							accept="*/*"
							maxSize={10 * 1024 * 1024}
							maxFiles={5}
							files={fileData[field.name] || []}
							onFilesChange={(files) => updateFileData(field.name, files)}
							uploadText={`Click to upload files for ${field.name}`}
							dragText={`Drop files here for ${field.name}`}
							size="sm"
							showPreview={true}
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
			</FormField>
		);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetTrigger asChild>
				<Button className="w-full whitespace-nowrap">
					<Plus className="w-4 h-4 mr-2" />
					Add Record
				</Button>
			</SheetTrigger>
			<SheetContent side="right" size="lg">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						Create Record
					</SheetTitle>
					<SheetDescription>
						Add a new record to{" "}
						<span className="font-light">{collection?.name}</span> collection
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<Form onSubmit={handleSubmit}>
						<div className="space-y-6">
							{collection &&
							collection.schema?.fields?.filter((field) => field.name !== "id")
								.length === 0 ? (
								<div className="text-center py-8">
									<Database className="w-12 h-12 mx-auto text-nocta-400 mb-4" />
									<h3 className="text-lg font-light text-nocta-900 dark:text-nocta-100 mb-2">
										No fields to fill
									</h3>
									<p className="text-nocta-600 dark:text-nocta-400 mb-4">
										This collection only has an auto-generated ID field. No
										additional data is required.
									</p>
									<p className="text-sm text-nocta-500 dark:text-nocta-500">
										You can still create a record, or add more fields to this
										collection first.
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
					<Button type="submit" disabled={submitting} onClick={handleSubmit}>
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
	);
}
