import {
	EyeIcon,
	PencilIcon,
	TrashIcon,
	UserIcon,
	UserPlusIcon,
} from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
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
	CreateUserSheet,
	EditUserSheet,
	UserDetailsSheet,
	UsersHeader,
} from "@/components/users";
import { CreateRoleSheet } from "@/components/roles";
import { useDebounce, useDeleteUser, useUsersWithPagination } from "@/hooks/";
import { useUI, useUIActions } from "@/stores/client.store";
import type { User } from "@/types/api";

interface ExtendedUser extends User {
	status: "active" | "inactive";
	locked: boolean;
}

const roleVariants: Record<
	string,
	"destructive" | "secondary" | "success" | "warning" | "outline" | "default"
> = {
	admin: "success" as const,
	user: "warning" as const,
	guest: "destructive" as const,
};

const statusColors = {
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
	inactive:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
};

const getProxyUrl = (originalUrl: string): string => {
	if (
		originalUrl.startsWith("https://lh3.googleusercontent.com") ||
		originalUrl.startsWith("https://avatars.githubusercontent.com")
	) {
		const proxyUrl = `/api/avatar-proxy?url=${encodeURIComponent(originalUrl)}`;
		return proxyUrl;
	}
	return originalUrl;
};

export default function UsersComponent() {
	const [localSearchTerm, setLocalSearchTerm] = useState("");
	const searchTerm = useDebounce(localSearchTerm, 300);
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize] = useState(10);

	useEffect(() => {
		setCurrentPage(1);
	}, [searchTerm]);

	const deleteUserMutation = useDeleteUser();

	const { data, isLoading, error } = useUsersWithPagination({
		currentPage,
		pageSize,
		searchTerm,
	});

	const users = useMemo(() => data?.users || [], [data?.users]);
	const totalCount = data?.pagination?.total_count || 0;
	const loading = isLoading;

	const { modals, sheets } = useUI();
	const { openModal, closeModal, openSheet, closeSheet } = useUIActions();

	const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
	const [userToEdit, setUserToEdit] = useState<User | null>(null);
	const [userToDelete, setUserToDelete] = useState<{
		id: number;
		email: string;
	} | null>(null);

	const handleDeleteUser = async (userId: number) => {
		const user = extendedUsers.find((u) => u.id === userId);
		if (!user) return;

		setUserToDelete({ id: userId, email: user.email });
		openModal("deleteUser");
	};

	const confirmDeleteUser = async () => {
		if (!userToDelete) return;

		deleteUserMutation.mutate(userToDelete.id, {
			onSuccess: () => {
				closeModal("deleteUser");
				setUserToDelete(null);
			},
			onError: () => {
				closeModal("deleteUser");
				setUserToDelete(null);
			},
		});
	};

	const cancelDeleteUser = () => {
		closeModal("deleteUser");
		setUserToDelete(null);
	};

	const handleViewUser = (userId: number) => {
		setSelectedUserId(userId);
		openSheet("userDetails");
	};

	const handleEditUser = (userId: number) => {
		const user = users.find((u) => u.id === userId);
		if (user) {
			setUserToEdit(user);
			openSheet("editUser");
		}
	};

	const getInitials = (email: string): string => {
		return email.split("@")[0].substring(0, 2).toUpperCase();
	};

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

	const extendedUsers: ExtendedUser[] = useMemo(
		() =>
			users.map((user) => ({
				...user,
				status: user.is_active ? "active" : "inactive",
				locked: user.locked_until
					? new Date(user.locked_until) > new Date()
					: false,
			})),
		[users],
	);

	const columns: TableColumn<ExtendedUser>[] = [
		{
			key: "id",
			title: "ID",
			render: (_, user) => (
				<div className="text-sm text-nocta-600 dark:text-nocta-400">
					{user.id}
				</div>
			),
		},
		{
			key: "user",
			title: "User",
			render: (_, user) => (
				<div className="flex items-center gap-3 w-54">
					<Avatar
						className="w-8 h-8 aspect-square"
						size="sm"
						src={user?.avatar_url ? getProxyUrl(user.avatar_url) : undefined}
						fallback={getInitials(user.email)}
					/>
					<div>
						<div className="font-light text-nocta-900 dark:text-nocta-100 ">
							{user.username || user.email}
						</div>
						<div className="text-sm text-nocta-500 dark:text-nocta-500 max-w-48 whitespace-nowrap truncate">
							{user.email}
						</div>
					</div>
				</div>
			),
		},
		{
			key: "role",
			title: "Role",
			render: (_, user) => {
				return (
					<Badge
						size="sm"
						variant={roleVariants[user.role] || "default"}
						className="inline-flex items-center gap-1"
					>
						{user.role}
					</Badge>
				);
			},
		},
		{
			key: "status",
			title: "Status",
			render: (_, user) => (
				<Badge size="sm" className={statusColors[user.status || "active"]}>
					{user.status || "active"}
				</Badge>
			),
		},
		{
			key: "is_verified",
			title: "Verified",
			render: (_, user) => (
				<Badge size="sm" variant={user.is_verified ? "success" : "secondary"}>
					{user.is_verified ? "Verified" : "Unverified"}
				</Badge>
			),
		},
		{
			key: "locked",
			title: "Locked",
			render: (_, user) => (
				<Badge size="sm" variant={user.locked ? "destructive" : "secondary"}>
					{user.locked ? "Locked" : "Unlocked"}
				</Badge>
			),
		},
		{
			key: "last_login_at",
			title: "Last Login",
			render: (_, user) => (
				<div className="text-sm">
					{user.last_login_at ? (
						<div>
							<div className="text-nocta-900 dark:text-nocta-100">
								{new Date(user.last_login_at).toLocaleDateString()}
							</div>
							<div className="text-nocta-500 dark:text-nocta-500">
								{new Date(user.last_login_at).toLocaleTimeString()}
							</div>
						</div>
					) : (
						<span className="text-nocta-500 dark:text-nocta-500">Never</span>
					)}
				</div>
			),
		},
		{
			key: "created_at",
			title: "Created",
			render: (_, user) => (
				<div className="text-sm">
					<div className="text-nocta-900 dark:text-nocta-100">
						{new Date(user.created_at).toLocaleDateString()}
					</div>
					<div className="text-nocta-500 dark:text-nocta-500">
						{new Date(user.created_at).toLocaleTimeString()}
					</div>
				</div>
			),
		},
		{
			key: "actions",
			title: "Actions",
			align: "left",
			className: "w-32",
			render: (_, user) => (
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						className="w-8 h-8 p-0"
						onClick={() => handleViewUser(user.id)}
						title="View User Details"
					>
						<EyeIcon size={16} />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="w-8 h-8 p-0"
						onClick={() => handleEditUser(user.id)}
						title="Edit User"
					>
						<PencilIcon size={16} />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="w-8 h-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
						onClick={() => handleDeleteUser(user.id)}
					>
						<TrashIcon size={16} />
					</Button>
				</div>
			),
		},
	];

	if (loading && !data) {
		return (
			<div className="flex items-center justify-center h-svh">
				<div className="text-center">
					<Spinner className="w-8 h-8 mx-auto mb-4" />
					<p className="text-nocta-600 dark:text-nocta-400">Loading users...</p>
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
							<UserIcon size={32} />
						</span>
					</div>
					<h3 className="text-lg font-light text-nocta-900 dark:text-nocta-100 mb-2">
						Error loading users
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
			<UsersHeader
				usersCount={totalCount}
				searchTerm={localSearchTerm}
				onSearchChange={setLocalSearchTerm}
				onCreateUser={() => openSheet("createUser")}
				onCreateRole={() => openSheet("createRole")}
			/>

			{extendedUsers.length > 0 || (loading && !data) ? (
				<div className="space-y-4">
					<div className="overflow-x-auto">
						<Table
							columns={
								columns as unknown as TableColumn<Record<string, unknown>>[]
							}
							data={extendedUsers as unknown as Record<string, unknown>[]}
							loading={loading && !data} // Only show spinner on initial load
							pagination={{
								current: currentPage,
								pageSize: pageSize,
								total: totalCount,
								onChange: handlePageChange,
							}}
						/>
					</div>
				</div>
			) : (
				<Card>
					<CardContent className="py-12">
						<div className="text-center">
							<div className="p-3 rounded-full bg-nocta-100 dark:bg-nocta-800/30 w-fit mx-auto mb-4">
								<span className="text-nocta-400 dark:text-nocta-500">
									<UserIcon size={32} />
								</span>
							</div>
							<h3 className="text-lg font-light text-nocta-900 dark:text-nocta-100 mb-2">
								{searchTerm ? "No users found" : "No users yet"}
							</h3>
							<p className="text-nocta-600 dark:text-nocta-400 mb-4 max-w-sm mx-auto">
								{searchTerm
									? `No users match "${searchTerm}". Try a different search term.`
									: "Get started by adding your first user account."}
							</p>
							{!searchTerm && (
								<Button onClick={() => openSheet("createUser")}>
									<span className="mr-2">
										<UserPlusIcon size={16} />
									</span>
									Create New User
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			<CreateUserSheet
				isOpen={sheets.createUser}
				onOpenChange={(open) => !open && closeSheet("createUser")}
			/>

			<CreateRoleSheet
				isOpen={sheets.createRole}
				onOpenChange={(open) => !open && closeSheet("createRole")}
			/>

			<UserDetailsSheet
				isOpen={sheets.userDetails}
				onOpenChange={(open) => !open && closeSheet("userDetails")}
				userId={selectedUserId}
			/>

			<EditUserSheet
				isOpen={sheets.editUser}
				onOpenChange={(open) => !open && closeSheet("editUser")}
				user={userToEdit}
			/>

			<Dialog
				open={modals.deleteUser}
				onOpenChange={(open) => !open && closeModal("deleteUser")}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete User</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete user "{userToDelete?.email}"? This
							action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogActions>
							<DialogClose asChild>
								<Button variant="ghost" onClick={cancelDeleteUser}>
									Cancel
								</Button>
							</DialogClose>
							<Button
								variant="primary"
								onClick={confirmDeleteUser}
								disabled={loading}
							>
								{loading ? (
									<>
										<Spinner className="mr-2 h-4 w-4" />
										Deleting...
									</>
								) : (
									"Delete User"
								)}
							</Button>
						</DialogActions>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

export const Route = createFileRoute("/users")({
	component: UsersComponent,
});
