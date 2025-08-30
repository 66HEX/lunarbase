import { FloppyDiskIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { useUpdateCollection } from "@/hooks";
import type {
	Collection,
	FieldDefinition,
	UpdateCollectionRequest,
} from "@/types/api";
import { fieldTypeIcons, fieldTypeOptions } from "./constants";
import {
	type EditCollectionFormData,
	editCollectionSchema,
} from "./validation";

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
	const [editCollectionDescription, setEditCollectionDescription] =
		useState("");
	const [editFields, setEditFields] = useState<FieldDefinition[]>([]);
	const [allowClose, setAllowClose] = useState(true);
	const allowCloseRef = useRef(setAllowClose);

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
		if (index === 0) return;
		setEditFields((prev) => prev.filter((_, i) => i !== index));
	};

	const updateEditField = (
		index: number,
		updates: Partial<FieldDefinition>,
	) => {
		setEditFields((prev) =>
			prev.map((field, i) => (i === index ? { ...field, ...updates } : field)),
		);

		const fieldErrorKey = `edit_field_${index}_name`;
		if (editFieldErrors[fieldErrorKey]) {
			setEditFieldErrors((prev) => ({ ...prev, [fieldErrorKey]: "" }));
		}
	};

	const validateEditForm = (): boolean => {
		const formData: EditCollectionFormData = {
			name: editCollectionName,
			description: editCollectionDescription || undefined,
			schema: { fields: editFields },
		};

		const result = editCollectionSchema.safeParse(formData);

		if (!result.success) {
			const newErrors: { [key: string]: string } = {};

			result.error.issues.forEach((error) => {
				const path = error.path.join(".");

				if (path === "name") {
					newErrors.editCollectionName = error.message;
				} else if (path === "schema.fields") {
					newErrors.editFields = error.message;
				} else if (path.startsWith("schema.fields.")) {
					const fieldIndex = path.split(".")[2];
					const fieldProperty = path.split(".")[3];

					if (fieldProperty === "name") {
						newErrors[`edit_field_${fieldIndex}_name`] = error.message;
					}
				}
			});

			setEditFieldErrors(newErrors);

			toast({
				title: "Validation Error",
				description: "Please fix the validation errors in the form",
				variant: "destructive",
				position: "bottom-right",
				duration: 3000,
			});

			return false;
		}

		setEditFieldErrors({});
		return true;
	};

	const handleUpdateCollection = async () => {
		if (!validateEditForm() || !collection) return;

		setEditSubmitting(true);

		try {
			const request: UpdateCollectionRequest = {
				name: editCollectionName,
				description: editCollectionDescription || undefined,
				schema: { fields: editFields },
			};

			await updateCollectionMutation.mutateAsync({
				name: collection.name,
				data: request,
			});

			onOpenChange(false);
			setEditCollectionName("");
			setEditCollectionDescription("");
			setEditFields([]);
			setEditFieldErrors({});
		} catch (error) {
			console.error("Collection update error:", error);
		} finally {
			setEditSubmitting(false);
		}
	};

	useEffect(() => {
		allowCloseRef.current = setAllowClose;
	}, [setAllowClose]);

	useEffect(() => {
		if (collection && isOpen) {
			setEditCollectionName(collection.name);
			setEditCollectionDescription(collection.description || "");
			setEditFields(collection.schema.fields || []);
			setEditFieldErrors({});
		}
	}, [collection, isOpen]);

	return (
		<Sheet
			open={isOpen}
			onOpenChange={(newOpen) => {
				if (!newOpen && (!allowClose || editSubmitting)) {
					return;
				}
				onOpenChange(newOpen);
				if (newOpen) {
					setAllowClose(true);
				}
			}}
		>
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
					<Tabs defaultValue="overview" className="w-full">
						<TabsList className="grid w-full grid-cols-2 !bg-nocta-950/80">
							<TabsTrigger value="overview">Overview</TabsTrigger>
							<TabsTrigger value="schema">Schema Fields</TabsTrigger>
						</TabsList>

						<TabsContent value="overview" className="mt-6">
							<Form
								onSubmit={(e) => {
									e.preventDefault();
									handleUpdateCollection();
								}}
							>
								<div className="space-y-6">
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
												onChange={(e) => {
													setEditCollectionName(e.target.value);
													if (editFieldErrors.editCollectionName) {
														setEditFieldErrors((prev) => ({
															...prev,
															editCollectionName: "",
														}));
													}
												}}
												variant={
													editFieldErrors.editCollectionName
														? "error"
														: "default"
												}
											/>
										</FormControl>
										<FormDescription>
											Must start with a letter and contain only letters,
											numbers, and underscores
										</FormDescription>
										<FormMessage />
									</FormField>

									<FormField name="editCollectionDescription">
										<FormLabel>Description</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Optional description for this collection"
												className="w-full"
												value={editCollectionDescription}
												onChange={(e) =>
													setEditCollectionDescription(e.target.value)
												}
												rows={3}
											/>
										</FormControl>
										<FormDescription>
											Provide a brief description of what this collection stores
										</FormDescription>
									</FormField>
								</div>
							</Form>
						</TabsContent>

						<TabsContent value="schema" className="mt-6">
							<Form
								onSubmit={(e) => {
									e.preventDefault();
									handleUpdateCollection();
								}}
							>
								<div className="space-y-4">
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
															<IconComponent color="oklch(0.708 0 0)" />
															<span className="font-light text-sm text-nocta-900 dark:text-nocta-100">
																{index === 0
																	? "ID Field"
																	: `Field ${index + 1}`}
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
																<TrashIcon size={16} />
															</Button>
														)}
													</div>

													<div className="grid grid-cols-12 gap-3 items-start">
														<div className="col-span-4">
															<FormField
																name={`edit_field_${index}_name`}
																error={
																	editFieldErrors[`edit_field_${index}_name`]
																}
															>
																<FormLabel
																	required={index > 0}
																	className="text-xs font-light text-nocta-600 dark:text-nocta-400"
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
																			editFieldErrors[
																				`edit_field_${index}_name`
																			]
																				? "error"
																				: "default"
																		}
																	/>
																</FormControl>
																<FormMessage />
															</FormField>
														</div>

														<div className="col-span-3">
															<FormField name={`edit_field_${index}_type`}>
																<FormLabel className="text-xs font-light text-nocta-600 dark:text-nocta-400">
																	Type
																</FormLabel>
																<FormControl>
																	<Select
																		portalProps={
																			{
																				"data-sheet-portal": "true",
																			} as React.HTMLAttributes<HTMLDivElement>
																		}
																		value={field.field_type}
																		onValueChange={(value) => {
																			updateEditField(index, {
																				field_type:
																					value as FieldDefinition["field_type"],
																			});
																		}}
																		allowCloseRef={allowCloseRef}
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

														<div className="col-span-3">
															<FormField name={`edit_field_${index}_default`}>
																<FormLabel className="text-xs font-light text-nocta-600 dark:text-nocta-400">
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

									<Button
										type="button"
										variant="primary"
										size="sm"
										onClick={addEditField}
										className="w-full"
									>
										<PlusIcon size={16} />
										<span className="ml-2">Add Field</span>
									</Button>
								</div>
							</Form>
						</TabsContent>
					</Tabs>
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
								<FloppyDiskIcon size={16} />
								<span className="ml-2">Update Collection</span>
							</>
						)}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
