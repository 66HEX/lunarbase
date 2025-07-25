import { createFileRoute } from "@tanstack/react-router";
import { Lock, Save, Shield, ShieldCheck, Unlock } from "lucide-react";
import { useEffect, useState } from "react";
import { PermissionsHeader } from "@/components/permissions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomApiError } from "@/lib/api";
import type { CollectionPermissions } from "@/types/api";

interface Permission {
	id: string;
	name: string;
	description: string;
	type: "system" | "collection" | "record";
	actions: string[];
}

interface RolePermission {
	role: string;
	permissions: Permission[];
	collections: { [collectionId: string]: CollectionPermissions };
}

// Mock data for demonstration
const mockPermissions: Permission[] = [
	{
		id: "users.manage",
		name: "Manage Users",
		description: "Create, edit, and delete user accounts",
		type: "system",
		actions: ["create", "read", "update", "delete"],
	},
	{
		id: "collections.manage",
		name: "Manage Collections",
		description: "Create, edit, and delete collections",
		type: "system",
		actions: ["create", "read", "update", "delete"],
	},
	{
		id: "permissions.manage",
		name: "Manage Permissions",
		description: "Configure user roles and permissions",
		type: "system",
		actions: ["read", "update"],
	},
	{
		id: "system.admin",
		name: "System Administration",
		description: "Full system access and configuration",
		type: "system",
		actions: ["*"],
	},
];

const mockRolePermissions: RolePermission[] = [
	{
		role: "Admin",
		permissions: mockPermissions,
		collections: {},
	},
	{
		role: "User",
		permissions: mockPermissions.filter(
			(p) => p.id !== "system.admin" && p.id !== "users.manage",
		),
		collections: {},
	},
	{
		role: "Guest",
		permissions: mockPermissions.filter((p) => p.actions.includes("read")),
		collections: {},
	},
];

const permissionTypeColors = {
	system:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
	collection:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
	record:
		"bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
};

export default function PermissionsComponent() {
	const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedRole, setSelectedRole] = useState<string>("Admin");
	const [editingRole, setEditingRole] = useState<string | null>(null);
	const [searchTerm] = useState("");

	useEffect(() => {
		fetchData();
	}, []);

	const fetchData = async () => {
		try {
			setLoading(true);
			setError(null);

			// In real app, these would be API calls
			// const [permissionsData, collectionsData] = await Promise.all([
			//   permissionsApi.getRolePermissions(),
			//   collectionsApi.list()
			// ]);

			// For now, using mock data
			await new Promise((resolve) => setTimeout(resolve, 1000));
			setRolePermissions(mockRolePermissions);

		} catch (error) {
			setError(
				error instanceof CustomApiError
					? error.message
					: "Failed to fetch permissions",
			);
		} finally {
			setLoading(false);
		}
	};

	const handlePermissionToggle = (
		role: string,
		permissionId: string,
		action: string,
	) => {
		setRolePermissions((prev) =>
			prev.map((rp) => {
				if (rp.role !== role) return rp;

				const permission = rp.permissions.find((p) => p.id === permissionId);
				if (!permission) return rp;

				const hasAction = permission.actions.includes(action);
				const updatedActions = hasAction
					? permission.actions.filter((a) => a !== action)
					: [...permission.actions, action];

				return {
					...rp,
					permissions: rp.permissions.map((p) =>
						p.id === permissionId ? { ...p, actions: updatedActions } : p,
					),
				};
			}),
		);
	};

	const handleSavePermissions = async (role: string) => {
		try {
			const roleData = rolePermissions.find((rp) => rp.role === role);
			if (!roleData) return;

			// In real app: await permissionsApi.updateRolePermissions(role, roleData);
			setEditingRole(null);
		} catch (error) {
			setError(
				error instanceof CustomApiError
					? error.message
					: "Failed to save permissions",
			);
		}
	};

	const selectedRoleData = rolePermissions.find(
		(rp) => rp.role === selectedRole,
	);
	const filteredPermissions =
		selectedRoleData?.permissions.filter(
			(permission) =>
				permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				permission.description.toLowerCase().includes(searchTerm.toLowerCase()),
		) || [];

	if (loading) {
		return (
			<div className="flex items-center justify-center h-svh">
				<div className="text-center">
					<Spinner className="w-8 h-8 mx-auto mb-4" />
					<p className="text-nocta-600 dark:text-nocta-400">
						Loading permissions...
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<PermissionsHeader rolesCount={rolePermissions.length} />

			{/* Error Alert */}
			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			<Tabs
				value={selectedRole}
				onValueChange={setSelectedRole}
				className="space-y-6"
			>
				{/* Role Tabs */}
				<div className="flex items-center justify-between">
					<TabsList className="grid w-full max-w-md grid-cols-3">
						{rolePermissions.map((roleData) => {
							return (
								<TabsTrigger
									key={roleData.role}
									value={roleData.role}
									className="flex items-center gap-2"
								>
									{roleData.role}
								</TabsTrigger>
							);
						})}
					</TabsList>

					{editingRole === selectedRole && (
						<div className="flex items-center gap-2">
							<Button variant="secondary" onClick={() => setEditingRole(null)}>
								Cancel
							</Button>
							<Button onClick={() => handleSavePermissions(selectedRole)}>
								<Save className="w-4 h-4 mr-2" />
								Save Changes
							</Button>
						</div>
					)}
				</div>

				{/* Role Content */}
				{rolePermissions.map((roleData) => {
					return (
						<TabsContent
							key={roleData.role}
							value={roleData.role}
							className="space-y-6"
						>
							{/* Permissions List */}
							{filteredPermissions.length > 0 ? (
								<div className="grid gap-4">
									{filteredPermissions.map((permission) => (
										<Card key={permission.id}>
											<CardContent className="p-6">
												<div className="flex items-start justify-between">
													<div className="flex-1">
														<div className="flex items-center gap-3 mb-2">
															<h3 className="font-semibold text-nocta-900 dark:text-nocta-100">
																{permission.name}
															</h3>
															<Badge
																className={
																	permissionTypeColors[permission.type]
																}
															>
																{permission.type}
															</Badge>
														</div>
														<p className="text-sm text-nocta-600 dark:text-nocta-400 mb-4">
															{permission.description}
														</p>

														{/* Actions */}
														<div className="space-y-2">
															<p className="text-sm font-medium text-nocta-700 dark:text-nocta-300">
																Actions:
															</p>
															<div className="flex flex-wrap gap-2">
																{["create", "read", "update", "delete"].map(
																	(action) => {
																		const hasAction =
																			permission.actions.includes(action) ||
																			permission.actions.includes("*");
																		const isWildcard =
																			permission.actions.includes("*");

																		return (
																			<div
																				key={action}
																				className="flex items-center gap-2"
																			>
																				{editingRole === roleData.role &&
																				!isWildcard ? (
																					<Checkbox
																						id={`${permission.id}-${action}`}
																						checked={hasAction}
																						onCheckedChange={() =>
																							handlePermissionToggle(
																								roleData.role,
																								permission.id,
																								action,
																							)
																						}
																					/>
																				) : (
																					<div
																						className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
																							hasAction
																								? "bg-blue-500 border-blue-500"
																								: "border-nocta-300 dark:border-nocta-600"
																						}`}
																					>
																						{hasAction && (
																							<div className="w-2 h-2 bg-white rounded-sm" />
																						)}
																					</div>
																				)}
																				<label
																					htmlFor={`${permission.id}-${action}`}
																					className={`text-sm capitalize cursor-pointer ${
																						hasAction
																							? "text-nocta-900 dark:text-nocta-100 font-medium"
																							: "text-nocta-500 dark:text-nocta-500"
																					}`}
																				>
																					{action}
																					{isWildcard && " (all)"}
																				</label>
																			</div>
																		);
																	},
																)}
															</div>
														</div>
													</div>

													<div className="ml-4">
														{permission.actions.includes("*") ? (
															<div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
																<Unlock className="w-5 h-5 text-green-600 dark:text-green-400" />
															</div>
														) : permission.actions.length > 0 ? (
															<div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
																<ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
															</div>
														) : (
															<div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
																<Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
															</div>
														)}
													</div>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							) : (
								<Card>
									<CardContent className="py-12">
										<div className="text-center">
											<div className="p-3 rounded-full bg-nocta-100 dark:bg-nocta-800/30 w-fit mx-auto mb-4">
												<Shield className="w-8 h-8 text-nocta-400 dark:text-nocta-500" />
											</div>
											<h3 className="text-lg font-semibold text-nocta-900 dark:text-nocta-100 mb-2">
												{searchTerm
													? "No permissions found"
													: "No permissions configured"}
											</h3>
											<p className="text-nocta-600 dark:text-nocta-400 max-w-sm mx-auto">
												{searchTerm
													? `No permissions match "${searchTerm}". Try a different search term.`
													: "This role has no permissions configured yet."}
											</p>
										</div>
									</CardContent>
								</Card>
							)}
						</TabsContent>
					);
				})}
			</Tabs>
		</div>
	);
}

export const Route = createFileRoute("/permissions")({
	component: PermissionsComponent,
});
