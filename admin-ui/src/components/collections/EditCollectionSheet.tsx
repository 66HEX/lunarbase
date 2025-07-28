import { Plus, Save, Trash2 } from "lucide-react";
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
import { useUpdateCollection } from "@/hooks/collections/useCollectionMutations";
import type {
	Collection,
	FieldDefinition,
	UpdateCollectionRequest,
} from "@/types/api";
import { fieldTypeIcons, fieldTypeOptions } from "./constants";

interface EditCollectionSheetProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	collection: Collection | null;
}

export function EditCollectionSheet({
	isOpen,
	onOpenChange,
	collection,
}: EditCollectionSheetProps) {
	const updateCollectionMutation = useUpdateCollection();

	const [editSubmitting, setEditSubmitting] = useState(false);
	const [editFieldErrors, setEditFieldErrors] = useState<{
		[key: string]: string;
	}>({});
	const [editCollectionName, setEditCollectionName] = useState("");
	const [editFields, setEditFields] = useState<FieldDefinition[]>([]);

	const addEditField = () => {
		setEditFields((prev) => [
			...prev,
			{
				name: "",
				field_type: "text",
				required: false,
				default_value: null,
			},
		]);
	};

	const removeEditField = (index: number) => {
		if (index === 0) return; // Don't allow removing the ID field
		setEditFields((prev) => prev.filter((_, i) => i !== index));
	};

	const updateEditField = (
		index: number,
		updates: Partial<FieldDefinition>,
	) => {
		setEditFields((prev) =>
			prev.map((field, i) => (i === index ? { ...field, ...updates } : field)),
		);
	};

	const validateEditForm = (): boolean => {
		const newErrors: { [key: string]: string } = {};

		if (!editCollectionName.trim()) {
			newErrors.editCollectionName = "Collection name is required";
		} else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(editCollectionName)) {
			newErrors.editCollectionName =
				"Collection name must start with a letter and contain only letters, numbers, and underscores";
		}

		const fieldNames = editFields.map((f) => f.name.toLowerCase());
		const duplicateNames = fieldNames.filter(
			(name, index) => fieldNames.indexOf(name) !== index,
		);
		if (duplicateNames.length > 0) {
			newErrors.editFields = "Field names must be unique";
		}

		editFields.forEach((field, index) => {
			if (!field.name.trim()) {
				newErrors[`edit_field_${index}_name`] = "Field name is required";
			} else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field.name)) {
				newErrors[`edit_field_${index}_name`] =
					"Field name must start with a letter and contain only letters, numbers, and underscores";
			}
		});

		setEditFieldErrors(newErrors);

		return Object.keys(newErrors).length === 0;
	};

	const handleUpdateCollection = async () => {
		if (!validateEditForm() || !collection) return;

		setEditSubmitting(true);

		try {
			const request: UpdateCollectionRequest = {
				name: editCollectionName,
				schema: { fields: editFields },
			};

			await updateCollectionMutation.mutateAsync({
				name: collection.name,
				data: request,
			});

			// Close sheet and reset form
			onOpenChange(false);
			setEditCollectionName("");
			setEditFields([]);
			setEditFieldErrors({});
		} catch (error) {
			console.error("Collection update error:", error);
		} finally {
			setEditSubmitting(false);
		}
	};

	// Initialize form when collection changes
	useEffect(() => {
		if (collection && isOpen) {
			setEditCollectionName(collection.name);
			setEditFields(collection.schema.fields || []);
			setEditFieldErrors({});
		}
	}, [collection, isOpen]);

	return (
		<Sheet open={isOpen} onOpenChange={onOpenChange}>
			<SheetContent side="right" size="xl">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						Edit Collection
					</SheetTitle>
					<SheetDescription>
						Modify collection schema and settings
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<Form
						onSubmit={(e) => {
							e.preventDefault();
							handleUpdateCollection();
						}}
					>
						<div className="space-y-6">
							{/* Collection Name */}
							<FormField
								name="editCollectionName"
								error={editFieldErrors.editCollectionName}
							>
								<FormLabel required>Collection Name</FormLabel>
								<FormControl>
									<Input
										placeholder="e.g., users, products, orders"
										className="w-full"
										value={editCollectionName}
										onChange={(e) => setEditCollectionName(e.target.value)}
										variant={
											editFieldErrors.editCollectionName ? "error" : "default"
										}
									/>
								</FormControl>
								<FormDescription>
									Must start with a letter and contain only letters, numbers,
									and underscores
								</FormDescription>
								<FormMessage />
							</FormField>

							{/* Schema Fields */}
							<div className="space-y-4">
								<h3 className="text-lg font-medium text-nocta-900 dark:text-nocta-100">
									Schema Fields
								</h3>

								<div className="space-y-3">
									{editFields.map((field, index) => {
										const IconComponent = fieldTypeIcons[field.field_type];
										return (
											<div
												key={`edit-field-${index}`}
												className="p-4 bg-nocta-100 dark:bg-nocta-800/30 rounded-md"
											>
												<div className="flex items-center justify-between mb-3">
													<div className="flex items-center gap-2">
														<IconComponent className="w-4 h-4 text-nocta-600 dark:text-nocta-400" />
														<span className="font-medium text-sm text-nocta-900 dark:text-nocta-100">
															{index === 0 ? "ID Field" : `Field ${index + 1}`}
														</span>
													</div>
													{index > 0 && (
														<Button
															type="button"
															variant="ghost"
															size="sm"
															onClick={() => removeEditField(index)}
															className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-1"
														>
															<Trash2 className="w-4 h-4" />
														</Button>
													)}
												</div>

												{/* Fields in one row */}
												<div className="grid grid-cols-12 gap-3 items-start">
													{/* Field Name */}
													<div className="col-span-4">
														<FormField
															name={`edit_field_${index}_name`}
															error={
																editFieldErrors[`edit_field_${index}_name`]
															}
														>
															<FormLabel
																required={index > 0}
																className="text-xs font-medium text-nocta-600 dark:text-nocta-400"
															>
																Name
															</FormLabel>
															<FormControl>
																<Input
																	placeholder="field_name"
																	className="w-full"
																	value={field.name}
																	onChange={(e) =>
																		updateEditField(index, {
																			name: e.target.value,
																		})
																	}
																	disabled={index === 0}
																	variant={
																		editFieldErrors[`edit_field_${index}_name`]
																			? "error"
																			: "default"
																	}
																/>
															</FormControl>
															<FormMessage />
														</FormField>
													</div>

													{/* Field Type */}
													<div className="col-span-3">
														<FormField name={`edit_field_${index}_type`}>
															<FormLabel className="text-xs font-medium text-nocta-600 dark:text-nocta-400">
																Type
															</FormLabel>
															<FormControl>
																<Select
																	value={field.field_type}
																	onValueChange={(value) =>
																		updateEditField(index, {
																			field_type:
																				value as FieldDefinition["field_type"],
																		})
																	}
																	disabled={index === 0}
																>
																	<SelectTrigger className="w-full">
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent>
																		{fieldTypeOptions.map((option) => (
																			<SelectItem
																				key={`edit-type-${option.value}`}
																				value={option.value}
																			>
																				{option.label}
																			</SelectItem>
																		))}
																	</SelectContent>
																</Select>
															</FormControl>
														</FormField>
													</div>

													{/* Default Value */}
													<div className="col-span-3">
														<FormField name={`edit_field_${index}_default`}>
															<FormLabel className="text-xs font-medium text-nocta-600 dark:text-nocta-400">
																Default
															</FormLabel>
															<FormControl>
																<Input
																	placeholder="Optional"
																	className="w-full"
																	value={
																		typeof field.default_value === "string"
																			? field.default_value
																			: field.default_value
																				? JSON.stringify(field.default_value)
																				: ""
																	}
																	onChange={(e) =>
																		updateEditField(index, {
																			default_value: e.target.value || null,
																		})
																	}
																	disabled={index === 0}
																/>
															</FormControl>
														</FormField>
													</div>

													{/* Required Checkbox */}
													<div className="col-span-2 flex items-center h-full">
														<label className="flex items-center gap-2 cursor-pointer pt-6">
															<Checkbox
																checked={field.required}
																onCheckedChange={(checked) =>
																	updateEditField(index, {
																		required: checked as boolean,
																	})
																}
																disabled={index === 0}
															/>
															<span className="text-xs text-nocta-700 dark:text-nocta-300">
																Required
															</span>
														</label>
													</div>
												</div>
											</div>
										);
									})}
								</div>

								{/* Add Field Button */}
								<Button
									type="button"
									variant="primary"
									size="sm"
									onClick={addEditField}
									className="w-full"
								>
									<Plus className="w-4 h-4 mr-2" />
									Add Field
								</Button>
							</div>
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
						onClick={handleUpdateCollection}
					>
						{editSubmitting ? (
							<>
								<Spinner size="sm" className="mr-2" />
								Updating...
							</>
						) : (
							<>
								<Save className="w-4 h-4 mr-2" />
								Update Collection
							</>
						)}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
