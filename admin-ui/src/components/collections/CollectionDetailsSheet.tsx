import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { Collection } from "@/types/api";
import { fieldTypeIcons, getFieldTypeVariant } from "./constants";

interface CollectionDetailsSheetProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	collection: Collection | null;
}

export function CollectionDetailsSheet({
	isOpen,
	onOpenChange,
	collection,
}: CollectionDetailsSheetProps) {
	if (!collection) return null;

	return (
		<Sheet open={isOpen} onOpenChange={onOpenChange}>
			<SheetContent side="right" size="lg">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						Collection Details
					</SheetTitle>
					<SheetDescription>
						View collection schema and metadata
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<div className="space-y-6">
						{/* Basic Information */}
						<div className="space-y-4">
							<div className="space-y-4">
								<h3 className="text-lg font-medium text-nocta-900 dark:text-nocta-100">
									Basic Information
								</h3>
								<div className="p-4 bg-nocta-100 dark:bg-nocta-800/30 rounded-lg space-y-4">
									<div className="mb-4">
										<label className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
											Name
										</label>
										<p className="text-sm text-nocta-900 dark:text-nocta-100">
											{collection.name}
										</p>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
												Created
											</label>
											<p className="text-sm text-nocta-900 dark:text-nocta-100">
												{collection.created_at}
											</p>
										</div>
										<div>
											<label className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
												Updated
											</label>
											<p className="text-sm text-nocta-900 dark:text-nocta-100">
												{collection.updated_at}
											</p>
										</div>
									</div>
								</div>
							</div>
						</div>
						{/* Schema Fields */}
						<div className="space-y-4">
							<h3 className="text-lg font-medium text-nocta-900 dark:text-nocta-100">
								Schema Fields ({collection.schema?.fields?.length || 0})
							</h3>

							<div className="space-y-3">
								{collection.schema.fields.map((field, index) => {
									const IconComponent = fieldTypeIcons[field.field_type];
									return (
										<div
											key={`detail-field-${index}`}
											className="p-4 bg-nocta-100 dark:bg-nocta-800/30 rounded-md"
										>
											<div className="flex items-center justify-between">
												<div className="flex justify-between items-center gap-2 w-full">
													<div className="flex items-center gap-2">
														<IconComponent className="size-4 text-nocta-500" />
														<span className="text-nocta-900 dark:text-nocta-100">
															{field.name}
														</span>
														{field.required && (
															<Badge
																size="sm"
																variant="destructive"
																className="text-xs"
															>
																Required
															</Badge>
														)}
														{field.default_value !== undefined &&
														field.default_value !== null && (
															<div className="text-sm text-nocta-600 dark:text-nocta-400 ml-4">
																<span className="font-medium">Default:</span>{" "}
																{String(field.default_value)}
															</div>
														)}
													</div>
													<div className="flex justify-between items-center gap-2">
														<Badge
															size="sm"
															variant={getFieldTypeVariant(field.field_type)}
														>
															{field.field_type}
														</Badge>
													</div>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					</div>
				</div>

				<SheetFooter>
					<Button variant="primary" onClick={() => onOpenChange(false)}>
						Close
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
