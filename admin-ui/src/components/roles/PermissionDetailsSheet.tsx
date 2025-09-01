import { Check, ShieldCheckIcon, X, XCircleIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
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
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCollections } from "@/hooks/";
import { useRoleAllCollectionPermissions } from "@/hooks/permissions";
import type { Collection, Role } from "@/types/api";

interface PermissionDetailsSheetProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	role: Role | null;
}

const getPriorityLabel = (priority: number): string => {
	if (priority >= 90) return "Critical";
	if (priority >= 75) return "High";
	if (priority >= 50) return "Normal";
	if (priority >= 25) return "Low";
	return "Very Low";
};

const getPriorityVariant = (priority: number) => {
	if (priority >= 90) return "success";
	if (priority >= 75) return "success";
	if (priority >= 50) return "warning";
	if (priority >= 25) return "secondary";
	return "destructive";
};

const formatDate = (dateString: string): string => {
	const date = new Date(dateString);
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

const getPermissionBadgeVariant = (hasPermission: boolean) => {
	return hasPermission ? "success" : "secondary";
};

const PermissionBadge = ({
	type,
	hasPermission,
}: {
	type: string;
	hasPermission: boolean;
}) => (
	<Badge
		size="sm"
		variant={getPermissionBadgeVariant(hasPermission)}
		className="text-xs flex items-center gap-1"
	>
		{type}: {hasPermission ? <Check size={12} /> : <X size={12} />}
	</Badge>
);

export function PermissionDetailsSheet({
	isOpen,
	onOpenChange,
	role,
}: PermissionDetailsSheetProps) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { data: collectionsData } = useCollections();
	const collections = useMemo(
		() => collectionsData?.collections || [],
		[collectionsData?.collections],
	);

	const { data: permissionsData, isLoading: permissionsLoading } =
		useRoleAllCollectionPermissions(role?.name || "", {
			enabled: !!role?.name && isOpen,
		});

	useEffect(() => {
		if (isOpen && role) {
			setLoading(false);
			setError(null);
		} else {
			setError(null);
		}
	}, [isOpen, role]);

	if (!role) return null;

	const isLoading = loading || permissionsLoading;
	const rolePermissions = permissionsData || {};

	return (
		<Sheet open={isOpen} onOpenChange={onOpenChange}>
			<SheetContent side="right" size="xl">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						Role Details
					</SheetTitle>
					<SheetDescription>
						View role information and permissions across collections
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<div className="text-center">
								<Spinner className="w-8 h-8 mx-auto mb-4" />
								<p className="text-nocta-600 dark:text-nocta-400">
									Loading role details...
								</p>
							</div>
						</div>
					) : error ? (
						<div className="flex items-center justify-center py-8">
							<div className="text-center">
								<span className="mx-auto mb-4 text-nocta-500 block w-8 h-8">
									<XCircleIcon size={32} />
								</span>
								<p className="text-nocta-600 dark:text-nocta-400">{error}</p>
							</div>
						</div>
					) : (
						<Tabs defaultValue="overview" className="w-full">
							<TabsList className="grid w-full grid-cols-2 !bg-nocta-950/80">
								<TabsTrigger value="overview">Overview</TabsTrigger>
								<TabsTrigger value="permissions">
									Collection Permissions
								</TabsTrigger>
							</TabsList>

							<TabsContent value="overview" className="mt-6">
								<div className="space-y-4">
									<div className="p-4 bg-nocta-100 dark:bg-nocta-800/30 rounded-lg space-y-4">
										<div className="flex items-center gap-3 mb-4">
											<div className="p-2 bg-nocta-200 dark:bg-nocta-700 rounded-lg">
												<ShieldCheckIcon
													size={20}
													className="text-nocta-600 dark:text-nocta-400"
												/>
											</div>
											<div className="flex-1">
												<h4 className="text-lg font-light text-nocta-900 dark:text-nocta-100">
													{role.name}
												</h4>
												{role.description && (
													<p className="text-sm text-nocta-600 dark:text-nocta-400 mt-1">
														{role.description}
													</p>
												)}
											</div>
											<Badge
												size="sm"
												variant={getPriorityVariant(role.priority) as any}
												className="inline-flex items-center gap-1"
											>
												{getPriorityLabel(role.priority)}
											</Badge>
										</div>

										<div className="grid grid-cols-2 gap-4">
											<div>
												<label className="text-sm font-light text-nocta-600 dark:text-nocta-400">
													Role ID
												</label>
												<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
													{role.id}
												</p>
											</div>
											<div>
												<label className="text-sm font-light text-nocta-600 dark:text-nocta-400">
													Priority Level
												</label>
												<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
													{role.priority} ({getPriorityLabel(role.priority)})
												</p>
											</div>
										</div>

										<div className="grid grid-cols-2 gap-4">
											<div>
												<label className="text-sm font-light text-nocta-600 dark:text-nocta-400">
													Created
												</label>
												<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
													{formatDate(role.created_at)}
												</p>
											</div>
											<div>
												<label className="text-sm font-light text-nocta-600 dark:text-nocta-400">
													Last Updated
												</label>
												<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
													{formatDate(role.updated_at)}
												</p>
											</div>
										</div>

										<div>
											<label className="text-sm font-light text-nocta-600 dark:text-nocta-400">
												Collection Permissions
											</label>
											<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
												Configured for {Object.keys(rolePermissions).length}{" "}
												collection(s)
											</p>
										</div>
									</div>
								</div>
							</TabsContent>

							<TabsContent value="permissions" className="mt-6">
								<div className="space-y-4">
									{collections.length > 0 ? (
										<div className="space-y-3">
											{collections.map((collection: Collection) => {
												const permissions = rolePermissions[collection.name];
												const hasPermissions =
													permissions &&
													Object.values(permissions).some((p) => p === true);

												return (
													<div
														key={collection.name}
														className="p-4 bg-nocta-100 dark:bg-nocta-800/30 rounded-lg border border-nocta-200 dark:border-nocta-700/50"
													>
														<div className="flex items-center justify-between mb-3">
															<div>
																<h5 className="font-light text-nocta-900 dark:text-nocta-100">
																	{collection.display_name || collection.name}
																</h5>
																{collection.description && (
																	<p className="text-sm text-nocta-600 dark:text-nocta-400 mt-1">
																		{collection.description}
																	</p>
																)}
															</div>
															{!hasPermissions && (
																<Badge
																	size="sm"
																	variant="secondary"
																	className="text-xs"
																>
																	No Permissions
																</Badge>
															)}
														</div>

														{permissions ? (
															<div className="flex flex-wrap gap-2">
																<PermissionBadge
																	type="Create"
																	hasPermission={permissions.can_create}
																/>
																<PermissionBadge
																	type="Read"
																	hasPermission={permissions.can_read}
																/>
																<PermissionBadge
																	type="Update"
																	hasPermission={permissions.can_update}
																/>
																<PermissionBadge
																	type="Delete"
																	hasPermission={permissions.can_delete}
																/>
																<PermissionBadge
																	type="List"
																	hasPermission={permissions.can_list}
																/>
															</div>
														) : (
															<div className="text-sm text-nocta-500 dark:text-nocta-500">
																No permissions configured for this collection
															</div>
														)}
													</div>
												);
											})}
										</div>
									) : (
										<div className="text-center py-8">
											<p className="text-nocta-600 dark:text-nocta-400">
												No collections available
											</p>
										</div>
									)}
								</div>
							</TabsContent>
						</Tabs>
					)}
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
