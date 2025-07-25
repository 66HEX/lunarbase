import {
	Braces,
	Calendar,
	Database,
	FileText,
	Hash,
	Link as LinkIcon,
	Mail,
	Save,
	ToggleLeft,
	Type,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Form,
	FormControl,
	FormDescription,
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
import { Spinner } from "@/components/ui/spinner";
import { useCollections } from "@/hooks/collections/useCollections";
import type {
	ApiRecord,
	Collection,
	FieldDefinition,
	RecordData,
} from "@/types/api";

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

interface CollectionRecordsEditSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	record: ApiRecord | null;
	collection: Collection | null;
	onSubmit: (data: RecordData) => Promise<void>;
}

export function CollectionRecordsEditSheet({
	open,
	onOpenChange,
	record,
	collection,
	onSubmit,
}: CollectionRecordsEditSheetProps) {
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

	const updateFormData = (fieldName: string, value: string | number | boolean | null) => {
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
				{field.default_value && (
					<FormDescription>
						Default: {String(field.default_value)}
					</FormDescription>
				)}
				<FormMessage />
			</FormField>
		);
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" size="md">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						Edit Record
					</SheetTitle>
					<SheetDescription>
						Update record #{record?.id} in{" "}
						<span className="font-medium">{collection?.name}</span> collection
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
									<h3 className="text-lg font-medium text-nocta-900 dark:text-nocta-100 mb-2">
										No fields to edit
									</h3>
									<p className="text-nocta-600 dark:text-nocta-400 mb-4">
										This collection only has an auto-generated ID field. No
										additional data can be modified.
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
	);
}
