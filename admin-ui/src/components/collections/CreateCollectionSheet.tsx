import { FloppyDiskIcon, TrashIcon, PlusIcon } from "@phosphor-icons/react"
import { useEffect, useState, useRef } from "react";
import { toast } from "@/components/ui/toast";
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
import { useCreateCollection } from "@/hooks";
import type { CreateCollectionRequest, FieldDefinition } from "@/types/api";
import { fieldTypeIcons, fieldTypeOptions } from "./constants";
import { createCollectionSchema, type CreateCollectionFormData } from "./validation";

interface CreateCollectionSheetProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateCollectionSheet({
	isOpen,
	onOpenChange,
}: CreateCollectionSheetProps) {
	const createCollectionMutation = useCreateCollection();

	const [submitting, setSubmitting] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
	const [collectionName, setCollectionName] = useState("");
	const [collectionDescription, setCollectionDescription] = useState("");
	const [allowClose, setAllowClose] = useState(true);
	const allowCloseRef = useRef(setAllowClose);
	const [fields, setFields] = useState<FieldDefinition[]>([
		{
			name: "id",
			field_type: "number",
			required: true,
			default_value: null,
		},
	]);

	const addField = () => {
		setFields((prev) => [
			...prev,
			{
				name: "",
				field_type: "text",
				required: false,
				default_value: null,
			},
		]);
	};

	const removeField = (index: number) => {
		if (index === 0) return;
		setFields((prev) => prev.filter((_, i) => i !== index));
	};

	const updateField = (index: number, updates: Partial<FieldDefinition>) => {
		setFields((prev) =>
			prev.map((field, i) => (i === index ? { ...field, ...updates } : field)),
		);

		// Clear field errors when updating field values
		const fieldErrorKey = `field_${index}_name`;
		if (fieldErrors[fieldErrorKey]) {
			setFieldErrors((prev) => ({ ...prev, [fieldErrorKey]: "" }));
		}
	};

	const validateForm = (): boolean => {
		const formData: CreateCollectionFormData = {
			name: collectionName,
			description: collectionDescription || undefined,
			schema: { fields },
		};

		const result = createCollectionSchema.safeParse(formData);

		if (!result.success) {
			const newErrors: { [key: string]: string } = {};
			
			result.error.issues.forEach((error) => {
				const path = error.path.join('.');
				
				if (path === 'name') {
					newErrors.collectionName = error.message;
				} else if (path === 'schema.fields') {
					newErrors.fields = error.message;
				} else if (path.startsWith('schema.fields.')) {
					const fieldIndex = path.split('.')[2];
					const fieldProperty = path.split('.')[3];
					
					if (fieldProperty === 'name') {
						newErrors[`field_${fieldIndex}_name`] = error.message;
					}
				}
			});

			setFieldErrors(newErrors);

			toast({
				title: "Validation Error",
				description: "Please fix the validation errors in the form",
				variant: "destructive",
				position: "bottom-right",
				duration: 3000,
			});

			return false;
		}

		setFieldErrors({});
		return true;
	};

	const handleCreateCollection = async () => {
		if (!validateForm()) return;

		setSubmitting(true);

		try {
			const request: CreateCollectionRequest = {
				name: collectionName,
				description: collectionDescription || undefined,
				schema: { fields },
			};

			await createCollectionMutation.mutateAsync(request);

			setCollectionName("");
			setCollectionDescription("");
			setFields([
				{
					name: "id",
					field_type: "number",
					required: true,
					default_value: null,
				},
			]);
			setFieldErrors({});
			onOpenChange(false);
		} catch (error) {
			console.error("Collection creation error:", error);
		} finally {
			setSubmitting(false);
		}
	};

	useEffect(() => {
		allowCloseRef.current = setAllowClose;
	}, [setAllowClose]);

	useEffect(() => {
		if (isOpen) {
			setCollectionName("");
			setCollectionDescription("");
			setFields([
				{
					name: "id",
					field_type: "number",
					required: true,
					default_value: null,
				},
			]);
			setFieldErrors({});
		}
	}, [isOpen]);

	return (
		<Sheet
			open={isOpen}
			onOpenChange={(newOpen) => {
				if (!newOpen && (!allowClose || submitting)) {
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
						Create Collection
					</SheetTitle>
					<SheetDescription>
						Define a new data collection with custom schema
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<Tabs defaultValue="overview" className="w-full">
						<TabsList className="grid w-full grid-cols-2 !bg-nocta-950">
							<TabsTrigger value="overview">Overview</TabsTrigger>
							<TabsTrigger value="schema">Schema Fields</TabsTrigger>
						</TabsList>

						<TabsContent value="overview" className="mt-6">
							<Form
								onSubmit={(e) => {
									e.preventDefault();
									handleCreateCollection();
								}}
							>
								<div className="space-y-6">
									<FormField
										name="collectionName"
										error={fieldErrors.collectionName}
									>
										<FormLabel required>Collection Name</FormLabel>
										<FormControl>
											<Input
												placeholder="e.g., users, products, orders"
												className="w-full"
												value={collectionName}
											onChange={(e) => {
												setCollectionName(e.target.value);
												if (fieldErrors.collectionName) {
													setFieldErrors((prev) => ({ ...prev, collectionName: "" }));
												}
											}}
												variant={
													fieldErrors.collectionName ? "error" : "default"
												}
											/>
										</FormControl>
										<FormDescription>
											Must start with a letter and contain only letters,
											numbers, and underscores
										</FormDescription>
										<FormMessage />
									</FormField>

									<FormField name="collectionDescription">
										<FormLabel>Description</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Optional description for this collection"
												className="w-full"
												value={collectionDescription}
												onChange={(e) =>
													setCollectionDescription(e.target.value)
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
									handleCreateCollection();
								}}
							>
								<div className="space-y-4">
									<div className="space-y-3">
										{fields.map((field, index) => {
											const IconComponent = fieldTypeIcons[field.field_type];
											return (
												<div
													key={`field-${index}`}
													className="p-4 bg-nocta-100 dark:bg-nocta-800/30 rounded-md"
												>
													<div className="flex items-center justify-between mb-3">
														<div className="flex items-center gap-2">
															<IconComponent className="w-4 h-4 text-nocta-600 dark:text-nocta-400" />
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
																onClick={() => removeField(index)}
																className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-1"
															>
																<TrashIcon size={16} />
															</Button>
														)}
													</div>

													<div className="grid grid-cols-12 gap-3 items-start">
														<div className="col-span-4">
															<FormField
																name={`field_${index}_name`}
																error={fieldErrors[`field_${index}_name`]}
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
																			updateField(index, {
																				name: e.target.value,
																			})
																		}
																		disabled={index === 0}
																		variant={
																			fieldErrors[`field_${index}_name`]
																				? "error"
																				: "default"
																		}
																	/>
																</FormControl>
																<FormMessage />
															</FormField>
														</div>

														<div className="col-span-3">
															<FormField name={`field_${index}_type`}>
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
														updateField(index, {
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
																					key={`type-${option.value}`}
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
															<FormField name={`field_${index}_default`}>
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
																			updateField(index, {
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
																		updateField(index, {
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
										onClick={addField}
										className="w-full"
									>
										<PlusIcon />
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
						disabled={submitting}
						onClick={handleCreateCollection}
					>
						{submitting ? (
							<>
								<Spinner size="sm" className="mr-2" />
								Creating...
							</>
						) : (
							<>
								<FloppyDiskIcon />
								<span className="ml-2">
									Create Collection
								</span>
							</>
						)}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
