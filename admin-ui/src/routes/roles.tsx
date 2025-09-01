import {
	EyeIcon,
	PencilIcon,
	TrashIcon,
	ShieldIcon,
	ShieldPlusIcon,
} from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { TableColumn } from "@/components/ui/table";
import { Table } from "@/components/ui/table";

import {
	CreateRoleSheet,
	EditRoleSheet,
	PermissionDetailsSheet,
	RolesHeader,
} from "@/components/roles";
import { useDebounce } from "@/hooks/";
import { useRoles, useDeleteRole } from "@/hooks/permissions";
import { useUI, useUIActions } from "@/stores/client.store";
import type { Role } from "@/types/api";

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

export default function RolesComponent() {
	const [localSearchTerm, setLocalSearchTerm] = useState("");
	const searchTerm = useDebounce(localSearchTerm, 300);

	const deleteRoleMutation = useDeleteRole();

	const { data: roles = [], isLoading, error } = useRoles();

	const filteredRoles = useMemo(() => {
		if (!searchTerm) return roles;
		
		return roles.filter((role) =>
			role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			role.description?.toLowerCase().includes(searchTerm.toLowerCase())
		);
	}, [roles, searchTerm]);

	const loading = isLoading;

	const { modals, sheets } = useUI();
	const { openModal, closeModal, openSheet, closeSheet } = useUIActions();

	const [roleToDelete, setRoleToDelete] = useState<{
		id: number;
		name: string;
	} | null>(null);

	const [roleToEdit, setRoleToEdit] = useState<Role | null>(null);
	const [roleToView, setRoleToView] = useState<Role | null>(null);

	const handleDeleteRole = async (roleId: number) => {
		const role = filteredRoles.find((r) => r.id === roleId);
		if (!role) return;

		// Prevent deletion of admin role
		if (role.name === "admin") {
			return;
		}

		setRoleToDelete({ id: roleId, name: role.name });
		openModal("deleteRole");
	};

	const confirmDeleteRole = async () => {
		if (!roleToDelete) return;

		deleteRoleMutation.mutate(roleToDelete.name, {
			onSuccess: () => {
				closeModal("deleteRole");
				setRoleToDelete(null);
			},
			onError: () => {
				closeModal("deleteRole");
				setRoleToDelete(null);
			},
		});
	};

	const cancelDeleteRole = () => {
		closeModal("deleteRole");
		setRoleToDelete(null);
	};

	const handleViewRole = (roleId: number) => {
		const role = filteredRoles.find((r) => r.id === roleId);
		if (!role) return;

		setRoleToView(role);
		openSheet("roleDetails");
	};

	const handleEditRole = (roleId: number) => {
		const role = filteredRoles.find((r) => r.id === roleId);
		if (!role) return;

		setRoleToEdit(role);
		openSheet("editRole");
	};

	const columns: TableColumn<Role>[] = [
		{
			key: "id",
			title: "ID",
			render: (_, role) => (
				<div className="text-sm text-nocta-600 dark:text-nocta-400">
					{role.id}
				</div>
			),
		},
		{
			key: "name",
			title: "Role Name",
			render: (_, role) => (
				<div>
					<div className="font-light text-nocta-900 dark:text-nocta-100">
						{role.name}
					</div>
					{role.description && (
						<div className="text-sm text-nocta-500 dark:text-nocta-500 max-w-64 whitespace-nowrap truncate">
							{role.description}
						</div>
					)}
				</div>
			),
		},
		{
			key: "priority",
			title: "Priority",
			render: (_, role) => (
				<div className="flex items-center gap-2">
					<Badge
						size="sm"
						variant={getPriorityVariant(role.priority) as any}
						className="inline-flex items-center gap-1"
					>
						{getPriorityLabel(role.priority)}
					</Badge>
					<span className="text-sm text-nocta-500 dark:text-nocta-400">
						({role.priority})
					</span>
				</div>
			),
		},
		{
			key: "created_at",
			title: "Created",
			render: (_, role) => (
				<div className="text-sm">
					<div className="text-nocta-900 dark:text-nocta-100">
						{new Date(role.created_at).toLocaleDateString()}
					</div>
					<div className="text-nocta-500 dark:text-nocta-500">
						{new Date(role.created_at).toLocaleTimeString()}
					</div>
				</div>
			),
		},
		{
			key: "updated_at",
			title: "Updated",
			render: (_, role) => (
				<div className="text-sm">
					<div className="text-nocta-900 dark:text-nocta-100">
						{new Date(role.updated_at).toLocaleDateString()}
					</div>
					<div className="text-nocta-500 dark:text-nocta-500">
						{new Date(role.updated_at).toLocaleTimeString()}
					</div>
				</div>
			),
		},
		{
			key: "actions",
			title: "Actions",
			align: "left",
			className: "w-32",
			render: (_, role) => (
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						className="w-8 h-8 p-0"
						onClick={() => handleViewRole(role.id)}
						title="View Role Details"
					>
						<EyeIcon size={16} />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="w-8 h-8 p-0"
						onClick={() => handleEditRole(role.id)}
						title="Edit Role"
					>
						<PencilIcon size={16} />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className={`w-8 h-8 p-0 ${
							role.name === "admin"
								? "text-nocta-400 dark:text-nocta-600 cursor-not-allowed"
								: "text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
						}`}
						onClick={() => handleDeleteRole(role.id)}
						title={role.name === "admin" ? "Cannot delete admin role" : "Delete Role"}
						disabled={role.name === "admin"}
					>
						<TrashIcon size={16} />
					</Button>
				</div>
			),
		},
	];

	if (loading && !roles.length) {
		return (
			<div className="flex items-center justify-center h-svh">
				<div className="text-center">
					<Spinner className="w-8 h-8 mx-auto mb-4" />
					<p className="text-nocta-600 dark:text-nocta-400">Loading roles...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-svh">
				<div className="text-center">
					<div className="p-3 rounded-full bg-red-100 dark:bg-red-900/20 w-fit mx-auto mb-4">
						<span className="text-red-600 dark:text-red-400">
							<ShieldIcon size={32} />
						</span>
					</div>
					<h3 className="text-lg font-light text-nocta-900 dark:text-nocta-100 mb-2">
						Error loading roles
					</h3>
					<p className="text-nocta-600 dark:text-nocta-400 mb-4">
						{error.message || "Something went wrong"}
					</p>
					<Button onClick={() => window.location.reload()}>Try again</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<RolesHeader
				rolesCount={roles.length}
				searchTerm={localSearchTerm}
				onSearchChange={setLocalSearchTerm}
				onCreateRole={() => openSheet("createRole")}
			/>

			{filteredRoles.length > 0 || (loading && !roles.length) ? (
				<div className="space-y-4">
					<div className="overflow-x-auto">
						<Table
							columns={
								columns as unknown as TableColumn<Record<string, unknown>>[]
							}
							data={filteredRoles as unknown as Record<string, unknown>[]}
							loading={loading && !roles.length}
						/>
					</div>
				</div>
			) : (
				<Card>
					<CardContent className="py-12">
						<div className="text-center">
							<div className="p-3 rounded-full bg-nocta-100 dark:bg-nocta-800/30 w-fit mx-auto mb-4">
								<span className="text-nocta-400 dark:text-nocta-500">
									<ShieldIcon size={32} />
								</span>
							</div>
							<h3 className="text-lg font-light text-nocta-900 dark:text-nocta-100 mb-2">
								{searchTerm ? "No roles found" : "No roles yet"}
							</h3>
							<p className="text-nocta-600 dark:text-nocta-400 mb-4 max-w-sm mx-auto">
								{searchTerm
									? `No roles match "${searchTerm}". Try a different search term.`
									: "Get started by creating your first custom role."}
							</p>
							{!searchTerm && (
								<Button onClick={() => openSheet("createRole")}>
									<span className="mr-2">
										<ShieldPlusIcon size={16} />
									</span>
									Create New Role
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			<CreateRoleSheet
				isOpen={sheets.createRole}
				onOpenChange={(open) => !open && closeSheet("createRole")}
			/>

			<EditRoleSheet
				isOpen={sheets.editRole}
				onOpenChange={(open) => {
					if (!open) {
						closeSheet("editRole");
						setRoleToEdit(null);
					}
				}}
				role={roleToEdit}
			/>

			<PermissionDetailsSheet
				isOpen={sheets.roleDetails}
				onOpenChange={(open) => !open && (closeSheet("roleDetails"))}
				role={roleToView}
			/>
          

			<Dialog
				open={modals.deleteRole}
				onOpenChange={(open) => !open && closeModal("deleteRole")}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Role</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete role "{roleToDelete?.name}"? This
							action cannot be undone and will affect all users assigned to this role.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogActions>
							<DialogClose asChild>
								<Button variant="ghost" onClick={cancelDeleteRole}>
									Cancel
								</Button>
							</DialogClose>
							<Button
								variant="primary"
								onClick={confirmDeleteRole}
								disabled={deleteRoleMutation.isPending}
							>
								{deleteRoleMutation.isPending ? (
									<>
										<Spinner className="mr-2 h-4 w-4" />
										Deleting...
									</>
								) : (
									"Delete Role"
								)}
							</Button>
						</DialogActions>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export const Route = createFileRoute("/roles")({
	component: RolesComponent,
});