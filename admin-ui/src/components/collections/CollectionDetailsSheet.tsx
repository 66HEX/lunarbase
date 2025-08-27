import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
					<Tabs defaultValue="overview" className="w-full">
						<TabsList className="grid w-full grid-cols-2 !bg-nocta-950">
							<TabsTrigger value="overview">Overview</TabsTrigger>
							<TabsTrigger value="schema">Schema Fields</TabsTrigger>
						</TabsList>

						<TabsContent value="overview" className="mt-6">
							<div className="space-y-4">
								<div className="p-4 bg-nocta-100 dark:bg-nocta-800/30 rounded-lg space-y-4">
									<div>
										<label className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
											Name
										</label>
										<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
											{collection.name}
										</p>
									</div>
									{collection.description && (
										<div>
											<label className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
												Description
											</label>
											<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
												{collection.description}
											</p>
										</div>
									)}
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
												Created
											</label>
											<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
												{collection.created_at}
											</p>
										</div>
										<div>
											<label className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
												Updated
											</label>
											<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
												{collection.updated_at}
											</p>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-4">
										<div>
											<label className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
												Total Fields
											</label>
											<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
												{collection.schema?.fields?.length || 0}
											</p>
										</div>
										<div>
											<label className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
												Required Fields
											</label>
											<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
												{collection.schema?.fields?.filter((f) => f.required)
													.length || 0}
											</p>
										</div>
									</div>
								</div>
							</div>
						</TabsContent>

						<TabsContent value="schema" className="mt-6">
							<div className="space-y-4">
								<div className="space-y-3">
									{collection.schema.fields.map((field, index) => {
										const IconComponent = fieldTypeIcons[field.field_type];
										return (
											<div
												key={`detail-field-${index}`}
												className="p-4 bg-nocta-100 dark:bg-nocta-800/30 rounded-lg border border-nocta-200 dark:border-nocta-700/50"
											>
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-3">
														<IconComponent className="size-4 text-nocta-500" />
														<div className="flex items-center gap-2">
															<span className="font-medium text-nocta-900 dark:text-nocta-100">
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
														</div>
													</div>
													<Badge
														size="sm"
														variant={getFieldTypeVariant(field.field_type)}
													>
														{field.field_type}
													</Badge>
												</div>
												{field.default_value !== undefined &&
													field.default_value !== null && (
														<div className="mt-2 text-sm text-nocta-600 dark:text-nocta-400">
															<span className="font-medium">
																Default value:
															</span>{" "}
															<code className="text-xs">
																{String(field.default_value)}
															</code>
														</div>
													)}
											</div>
										);
									})}
								</div>
							</div>
						</TabsContent>
					</Tabs>
				</div>

				<SheetFooter>
					<SheetClose asChild>
						<Button variant="ghost">Close</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
