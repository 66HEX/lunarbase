import { useQueryClient } from "@tanstack/react-query";
import { Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/components/ui/toast";
import { CustomApiError } from "@/lib/api";
import { usePermissions, useUsers } from "@/stores";
import { useCollectionsStore } from "@/stores/collections-persist.store";
import type { Collection, CollectionPermissions } from "@/types/api";

interface CollectionPermissionsSheetProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	collection: Collection | null;
}

type PermissionType =
	| "can_create"
	| "can_read"
	| "can_update"
	| "can_delete"
	| "can_list";

export function CollectionPermissionsSheet({
	isOpen,
	onOpenChange,
	collection,
}: CollectionPermissionsSheetProps) {
	const { saveCollectionPermissions } = useCollectionsStore();
	const { users, fetchUsers } = useUsers();
	const {
		fetchRoles,
		fetchAllRolePermissionsForCollection,
		roles,
		collectionPermissions,
		loading: permissionsLoading,
	} = usePermissions();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [permissionsSubmitting, setPermissionsSubmitting] = useState(false);
	const [rolePermissions, setRolePermissions] = useState<
		CollectionPermissions["role_permissions"]
	>({});
	const [userPermissions, setUserPermissions] = useState<
		CollectionPermissions["user_permissions"]
	>({});

	const updateRolePermission = (
		role: string,
		permission: PermissionType,
		value: boolean,
	) => {
		setRolePermissions((prev) => ({
			...prev,
			[role]: {
				...prev[role],
				[permission]: value,
			},
		}));
	};

	const handleUserPermissionChange = (
		userId: number,
		permission: PermissionType,
		value: boolean | null,
	) => {
		setUserPermissions((prev) => ({
			...prev,
			[userId.toString()]: {
				...prev[userId.toString()],
				[permission]: value,
			},
		}));
	};

	const removeUserPermission = (userId: number) => {
		setUserPermissions((prev) => {
			const newPermissions = { ...prev };
			delete newPermissions[userId.toString()];
			return newPermissions;
		});
	};

	const handleSavePermissions = async () => {
		if (!collection) return;

		setPermissionsSubmitting(true);

		try {
			// Filter out null values from user permissions to avoid saving default states
			const filteredUserPermissions: CollectionPermissions["user_permissions"] =
				{};

			Object.entries(userPermissions).forEach(([userId, perms]) => {
				const filteredPerms: any = {};
				let hasExplicitPermissions = false;

				Object.entries(perms).forEach(([permType, permValue]) => {
					if (permValue !== null) {
						filteredPerms[permType] = permValue;
						hasExplicitPermissions = true;
					}
				});

				// Only include user if they have explicit permissions set
				if (hasExplicitPermissions) {
					filteredUserPermissions[userId] = filteredPerms;
				}
			});

			const permissions: CollectionPermissions = {
				role_permissions: rolePermissions,
				user_permissions: filteredUserPermissions,
			};

			await saveCollectionPermissions(collection.name, permissions);

			// Invalidate and refetch collections query
			queryClient.invalidateQueries({ queryKey: ["collections"] });

			onOpenChange(false);

			toast({
				title: "Success!",
				description: `Permissions for "${collection.name}" have been saved successfully.`,
				variant: "success",
				position: "bottom-center",
				duration: 3000,
			});
		} catch (error) {
			console.error("Permissions save error:", error);

			let errorMessage = "Failed to save permissions";

			if (error instanceof CustomApiError) {
				errorMessage = error.message;
			} else if (error instanceof Error) {
				errorMessage = error.message;
			} else if (typeof error === "string") {
				errorMessage = error;
			} else if (error && typeof error === "object" && "message" in error) {
				errorMessage = String(error.message);
			}

			toast({
				title: "Error",
				description: errorMessage,
				variant: "destructive",
				position: "bottom-center",
				duration: 5000,
			});
		} finally {
			setPermissionsSubmitting(false);
		}
	};

	// Initialize permissions when collection changes
	useEffect(() => {
		if (collection && isOpen) {
			// Fetch roles if not already loaded
			if (roles.length === 0) {
				fetchRoles();
			}

			// Fetch permissions from backend
			fetchAllRolePermissionsForCollection(collection.name);

			// Fetch users if not already loaded
			if (users.length === 0) {
				fetchUsers();
			}
		}
	}, [
		collection,
		isOpen,
		roles.length,
		users.length,
		fetchRoles,
		fetchAllRolePermissionsForCollection,
		fetchUsers,
	]);

	// Update local state when permissions are loaded from backend
	useEffect(() => {
		if (collection && collectionPermissions[collection.name]) {
			const backendPermissions = collectionPermissions[collection.name];

			// Convert backend permissions to component format
			const formattedRolePermissions: CollectionPermissions["role_permissions"] =
				{};

			Object.entries(backendPermissions).forEach(([roleName, permission]) => {
				formattedRolePermissions[roleName] = {
					can_create: permission.can_create,
					can_read: permission.can_read,
					can_update: permission.can_update,
					can_delete: permission.can_delete,
					can_list: permission.can_list,
				};
			});

			setRolePermissions(formattedRolePermissions);
			setUserPermissions(collection.permissions?.user_permissions || {});
		}
	}, [collection, collectionPermissions]);

	if (!collection) return null;

	const permissionTypes: PermissionType[] = [
		"can_create",
		"can_read",
		"can_update",
		"can_delete",
		"can_list",
	];
	const availableRoles = Object.keys(rolePermissions);

	return (
		<Sheet open={isOpen} onOpenChange={onOpenChange}>
			<SheetContent side="right" size="lg">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						Collection Permissions
					</SheetTitle>
					<SheetDescription>
						Manage access permissions for this collection
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<div className="space-y-6">
						{/* Role-based Permissions */}
						<div className="space-y-4">
							<h3 className="text-lg font-medium text-nocta-900 dark:text-nocta-100">
								Role-based Permissions
							</h3>

							{permissionsLoading ? (
								<div className="flex items-center justify-center py-8">
									<Spinner className="w-6 h-6" />
									<span className="ml-2 text-sm text-nocta-600 dark:text-nocta-400">
										Loading permissions...
									</span>
								</div>
							) : (
								<div className="space-y-3">
									{availableRoles.map((role) => (
										<div
											key={`role-${role}`}
											className="p-3 bg-nocta-100 dark:bg-nocta-800/30 rounded-md"
										>
											<div className="flex items-center justify-between mb-3">
												<div className="flex items-center gap-3">
													<Badge
														variant={
															role === "admin"
																? "success"
																: role === "user"
																	? "warning"
																	: "destructive"
														}
														size="sm"
													>
														{role}
													</Badge>
													<span className="text-sm text-nocta-900 dark:text-nocta-100">
														{role === "admin"
															? "Full access to all operations"
															: role === "user"
																? "Standard user access"
																: "Custom access"}
													</span>
												</div>
											</div>

											<div className="grid grid-cols-2 gap-2 text-nocta-600 dark:text-nocta-400">
												{permissionTypes.map((permission) => (
													<label
														key={`${role}-${permission}`}
														className="flex items-center gap-2 text-sm"
													>
														<Checkbox
															checked={
																rolePermissions[role]?.[permission] || false
															}
															onCheckedChange={(checked) =>
																updateRolePermission(
																	role,
																	permission,
																	checked as boolean,
																)
															}
														/>
														<span>
															{permission
																.replace("can_", "")
																.charAt(0)
																.toUpperCase() +
																permission.replace("can_", "").slice(1)}
														</span>
													</label>
												))}
											</div>
										</div>
									))}
								</div>
							)}
						</div>

						{/* User-specific Permissions */}
						<div className="space-y-4">
							<h3 className="text-lg font-medium text-nocta-900 dark:text-nocta-100">
								User-specific Permissions
							</h3>
							<p className="text-sm text-nocta-600 dark:text-nocta-400 mb-4">
								Override role permissions for specific users
							</p>

							{users.length === 0 ? (
								<p className="text-center text-nocta-500 dark:text-nocta-400 py-8">
									No users available
								</p>
							) : (
								<div className="space-y-3">
									{users.map((user) => {
										const permission = userPermissions[user.id.toString()];

										return (
											<div
												key={user.id}
												className="p-3 bg-nocta-50 dark:bg-nocta-800/20 rounded-lg relative"
											>
												<div className="flex items-center justify-between mb-3">
													<div className="flex items-center gap-3">
														<Badge variant="secondary" size="sm">
															{user.role}
														</Badge>
														<span className="text-sm text-nocta-600 dark:text-nocta-400">
															{user.email}
														</span>
													</div>
													{permission && (
														<Button
															variant="ghost"
															size="sm"
															onClick={() => removeUserPermission(user.id)}
															className="text-red-600 hover:text-red-700 absolute top-2 right-2"
														>
															<X className="w-4 h-4" />
														</Button>
													)}
												</div>

												<div className="grid grid-cols-2 gap-2 text-nocta-600 dark:text-nocta-400">
													{permissionTypes.map((perm) => {
														const permValue = permission?.[perm] ?? null;
														const permLabel =
															perm.replace("can_", "").charAt(0).toUpperCase() +
															perm.replace("can_", "").slice(1);

														// Get default permission from user's role
														const defaultRolePermission =
															rolePermissions[user.role]?.[perm] || false;

														// Checkbox should be checked if:
														// - explicitly set to true, OR
														// - set to null (default) AND user's role has this permission
														const isChecked =
															permValue === true ||
															(permValue === null && defaultRolePermission);

														return (
															<label
																key={perm}
																className="flex items-center gap-2 text-sm"
															>
																<Checkbox
																	checked={isChecked}
																	onCheckedChange={() => {
																		if (permValue === null) {
																			// From default state, set to opposite of default role permission
																			handleUserPermissionChange(
																				user.id,
																				perm,
																				!defaultRolePermission,
																			);
																		} else {
																			// From explicit state, return to default (null)
																			handleUserPermissionChange(
																				user.id,
																				perm,
																				null,
																			);
																		}
																	}}
																/>
																<span>{permLabel}</span>
																{permValue === false && (
																	<span className="text-xs text-red-500">
																		(Denied)
																	</span>
																)}
																{permValue === null && (
																	<span className="text-xs text-nocta-400">
																		(Default)
																	</span>
																)}
															</label>
														);
													})}
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</div>
				</div>

				<SheetFooter>
					<SheetClose asChild>
						<Button variant="ghost">Cancel</Button>
					</SheetClose>
					<Button
						disabled={permissionsSubmitting}
						onClick={handleSavePermissions}
					>
						{permissionsSubmitting ? (
							<>
								<Spinner size="sm" className="mr-2" />
								Saving...
							</>
						) : (
							<>
								<Save className="w-4 h-4 mr-2" />
								Save Permissions
							</>
						)}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
