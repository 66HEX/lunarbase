import { Save } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useCollections } from "@/hooks/collections/useCollections";
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
	validateFieldValue,
} from "./constants";

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

	// Get available collections for relation fields
	const availableCollections = collectionsData?.collections || [];

	useEffect(() => {
		if (open && record && collection) {
			initializeFormData();
			setFieldErrors({});
		}
	}, [open, record, collection]);

	const initializeFormData = () => {
		if (!record || !collection) return;

		const initialData: RecordData = {};
		collection.schema?.fields?.forEach((field) => {
			if (field.name !== "id") {
				const value = record.data[field.name];
				if (value !== null && value !== undefined) {
					initialData[field.name] =
						field.field_type === "json" && typeof value === "object"
							? JSON.stringify(value, null, 2)
							: value;
				} else {
					initialData[field.name] = getDefaultFieldValue(field.field_type);
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

	const validateForm = (): boolean => {
		if (!collection) return false;

		const newErrors: { [key: string]: string } = {};

		collection.schema?.fields?.forEach((field) => {
			if (field.name === "id") return;

			const value = formData[field.name];
			const error = validateFieldValue(field, value);
			if (error) {
				newErrors[field.name] = error;
			}
		});

		setFieldErrors(newErrors);
		return Object.keys(newErrors).length === 0;
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
				const value = formData[field.name];
				submitData[field.name] = processFieldValue(
					field.field_type,
					value,
					field.required,
				);
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
							value={value}
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
				<FormMessage />
			</FormField>
		);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent size="md">
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
									<Save className="w-4 h-4" />
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
