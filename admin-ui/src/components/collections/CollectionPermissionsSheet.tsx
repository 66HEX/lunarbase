import { Save } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import type { TableColumn } from "@/components/ui/table";
import { Table } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
	useAllRoleCollectionPermissions,
	useRoles,
	useSaveCollectionPermissions,
	useUsers,
} from "@/hooks";
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
	// All hooks must be called before any early returns
	const saveCollectionPermissionsMutation = useSaveCollectionPermissions();
	const { data: usersData } = useUsers();
	const users = usersData?.users || [];
	const { data: rolesData, isLoading: rolesLoading } = useRoles();
	const { data: collectionPermissionsData, isLoading: permissionsLoading } =
		useAllRoleCollectionPermissions(collection?.name || "", {
			enabled: !!collection?.name && isOpen,
		});

	const [permissionsSubmitting, setPermissionsSubmitting] = useState(false);
	const [rolePermissions, setRolePermissions] = useState<
		CollectionPermissions["role_permissions"]
	>({});
	const [userPermissions, setUserPermissions] = useState<
		CollectionPermissions["user_permissions"]
	>({});

	useEffect(() => {
		const roles = rolesData || [];
		if (roles.length > 0) {
			const initialRolePermissions: CollectionPermissions["role_permissions"] =
				{};
			roles.forEach((role: { name: string }) => {
				initialRolePermissions[role.name] = {
					can_create: false,
					can_read: false,
					can_update: false,
					can_delete: false,
					can_list: false,
				};
			});
			setRolePermissions(initialRolePermissions);
		}
	}, [rolesData]);

	useEffect(() => {
		const collectionPermissions = collectionPermissionsData || {};
		if (
			collection &&
			collectionPermissions &&
			Object.keys(collectionPermissions).length > 0
		) {
			const formattedRolePermissions: CollectionPermissions["role_permissions"] =
				{};

			Object.entries(collectionPermissions).forEach(
				([roleName, permission]) => {
					const typedPermission = permission as {
						can_create: boolean;
						can_read: boolean;
						can_update: boolean;
						can_delete: boolean;
						can_list: boolean;
					};
					formattedRolePermissions[roleName] = {
						can_create: typedPermission.can_create,
						can_read: typedPermission.can_read,
						can_update: typedPermission.can_update,
						can_delete: typedPermission.can_delete,
						can_list: typedPermission.can_list,
					};
				},
			);

			setRolePermissions(formattedRolePermissions);
			setUserPermissions(collection.permissions?.user_permissions || {});
		}
	}, [collection, collectionPermissionsData]);

	if (!collection) return null;

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

	const handleSavePermissions = async () => {
		if (!collection) return;

		setPermissionsSubmitting(true);

		try {
			const filteredUserPermissions: CollectionPermissions["user_permissions"] =
				{};

			Object.entries(userPermissions).forEach(([userId, perms]) => {
				const filteredPerms: {
					can_create: boolean | null;
					can_read: boolean | null;
					can_update: boolean | null;
					can_delete: boolean | null;
					can_list: boolean | null;
				} = {
					can_create: null,
					can_read: null,
					can_update: null,
					can_delete: null,
					can_list: null,
				};
				let hasExplicitPermissions = false;

				Object.entries(perms).forEach(([permType, permValue]) => {
					if (permValue !== null) {
						filteredPerms[permType as PermissionType] = permValue;
						hasExplicitPermissions = true;
					}
				});

				if (hasExplicitPermissions) {
					filteredUserPermissions[userId] = filteredPerms;
				}
			});

			const permissions: CollectionPermissions = {
				role_permissions: rolePermissions,
				user_permissions: filteredUserPermissions,
			};

			await saveCollectionPermissionsMutation.mutateAsync({
				collectionName: collection.name,
				permissions,
			});

			onOpenChange(false);
		} catch (error) {
			console.error("Permissions save error:", error);
		} finally {
			setPermissionsSubmitting(false);
		}
	};

	const permissionTypes: PermissionType[] = [
		"can_create",
		"can_read",
		"can_update",
		"can_delete",
		"can_list",
	];
	const availableRoles = Object.keys(rolePermissions);

	type RoleRow = { role: string };
	const roleColumns: TableColumn<RoleRow>[] = [
		{
			key: "role",
			title: "Role",
			className: "w-64",
			render: (_: unknown, row: RoleRow) => (
				<div className="flex items-center gap-3">
					<Badge
						variant={
							row.role === "admin"
								? "success"
								: row.role === "user"
									? "warning"
									: "destructive"
						}
						size="sm"
					>
						{row.role}
					</Badge>
					<span className="text-sm text-nocta-600 dark:text-nocta-400">
						{row.role === "admin"
							? "Full access"
							: row.role === "user"
								? "Standard access"
								: "Custom"}
					</span>
				</div>
			),
		},
		...permissionTypes.map((perm) => ({
			key: perm,
			title:
				perm.replace("can_", "").charAt(0).toUpperCase() +
				perm.replace("can_", "").slice(1),
			align: "center" as const,
			className: "w-28",
			render: (_: unknown, row: RoleRow) => (
				<Switch
					checked={rolePermissions[row.role]?.[perm] || false}
					onCheckedChange={(checked: boolean) =>
						updateRolePermission(row.role, perm, checked)
					}
					aria-label={`${row.role} ${perm}`}
				/>
			),
		})),
	];
	const roleData: RoleRow[] = availableRoles.map((r) => ({ role: r }));

	type UserRow = {
		id: number;
		email: string;
		role: string;
	};

	const userData: UserRow[] = users.map((u) => ({
		id: u.id,
		email: u.email,
		role: u.role,
	}));

	const userColumns: TableColumn<UserRow>[] = [
		{
			key: "user",
			title: "User",
			className: "w-64",
			render: (_: unknown, u: UserRow) => (
				<div className="flex items-center gap-3">
					<div className="truncate">
						<div className="text-sm text-nocta-900 dark:text-nocta-100 truncate max-w-64">
							{u.email}
						</div>
					</div>
				</div>
			),
		},
		...permissionTypes.map((perm) => ({
			key: perm,
			title:
				perm.replace("can_", "").charAt(0).toUpperCase() +
				perm.replace("can_", "").slice(1),
			align: "center" as const,
			className: "w-28",
			render: (_: unknown, u: UserRow) => {
				const userPerm = userPermissions[u.id.toString()]?.[perm];
				const defaultRolePerm = rolePermissions[u.role]?.[perm] || false;
				const effectiveValue =
					userPerm !== null && userPerm !== undefined
						? userPerm
						: defaultRolePerm;
				return (
					<Switch
						checked={effectiveValue}
						onCheckedChange={(checked: boolean) =>
							handleUserPermissionChange(u.id, perm, checked)
						}
						aria-label={`${u.email} ${perm}`}
					/>
				);
			},
		})),
	];

	return (
		<Sheet open={isOpen} onOpenChange={onOpenChange}>
			<SheetContent side="right" size="xxl">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						Collection Permissions
					</SheetTitle>
					<SheetDescription>
						Manage access permissions for this collection
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<Tabs defaultValue="roles" className="w-full">
						<TabsList className="grid w-full grid-cols-2 !bg-nocta-950/80">
							<TabsTrigger value="roles">Role-based Permissions</TabsTrigger>
							<TabsTrigger value="users">User-specific Permissions</TabsTrigger>
						</TabsList>

						<TabsContent value="roles" className="mt-6">
							<div className="space-y-4">
								{permissionsLoading || rolesLoading ? (
									<div className="flex items-center justify-center py-8">
										<Spinner className="w-6 h-6" />
										<span className="ml-2 text-sm text-nocta-600 dark:text-nocta-400">
											Loading permissions...
										</span>
									</div>
								) : (
									<Table
										columns={
											roleColumns as unknown as TableColumn<
												Record<string, unknown>
											>[]
										}
										data={roleData as unknown as Record<string, unknown>[]}
									/>
								)}
							</div>
						</TabsContent>

						<TabsContent value="users" className="mt-6">
							<div className="space-y-4">
								<Table
									columns={
										userColumns as unknown as TableColumn<
											Record<string, unknown>
										>[]
									}
									data={userData as unknown as Record<string, unknown>[]}
								/>
							</div>
						</TabsContent>
					</Tabs>
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
