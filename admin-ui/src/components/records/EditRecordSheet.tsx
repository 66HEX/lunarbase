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
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type {
	Collection,
	FieldDefinition,
	Record,
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
	const [submitting, setSubmitting] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
	const [formData, setFormData] = useState<RecordData>({});

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
