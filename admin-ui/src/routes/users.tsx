import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	Edit3,
	Eye,
	Search,
	Trash2,
	User as UserIcon,
	UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { TableColumn } from "@/components/ui/table";
import { Table } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { CreateUserSheet } from "@/components/users/CreateUserSheet";
import { EditUserSheet } from "@/components/users/EditUserSheet";
import { UserDetailsSheet } from "@/components/users/UserDetailsSheet";
import { useUsersQuery } from "@/hooks/useUsersQuery";
import { useUsersStore } from "@/stores/users-persist.store";
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

export default function UsersComponent() {
	const {
		searchTerm,
		currentPage,
		pageSize,
		deleteUser,
		setCurrentPage,
		setSearchTerm,
	} = useUsersStore();

	// Use React Query for data fetching with keepPreviousData
	const { data, isLoading, error } = useUsersQuery({
		currentPage,
		pageSize,
		searchTerm,
	});

	const users = data?.users || [];
	const totalCount = data?.pagination?.total_count || 0;
	const loading = isLoading;

	const [isCreateUserSheetOpen, setIsCreateUserSheetOpen] = useState(false);
	const [isUserDetailsSheetOpen, setIsUserDetailsSheetOpen] = useState(false);
	const [isEditUserSheetOpen, setIsEditUserSheetOpen] = useState(false);
	const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
	const [userToEdit, setUserToEdit] = useState<User | null>(null);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [userToDelete, setUserToDelete] = useState<{
		id: number;
		email: string;
	} | null>(null);
	const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);

	const { toast } = useToast();
	const queryClient = useQueryClient();

	useEffect(() => {
		setLocalSearchTerm(searchTerm);
	}, [searchTerm]);

	useEffect(() => {
		const timeoutId = setTimeout(() => {
			if (localSearchTerm !== searchTerm) {
				setSearchTerm(localSearchTerm);
			}
		}, 300); // 300ms debounce

		return () => clearTimeout(timeoutId);
	}, [localSearchTerm, searchTerm, setSearchTerm]);

	const handleDeleteUser = async (userId: number) => {
		const user = extendedUsers.find((u) => u.id === userId);
		if (!user) return;

		setUserToDelete({ id: userId, email: user.email });
		setDeleteDialogOpen(true);
	};

	const confirmDeleteUser = async () => {
		if (!userToDelete) return;

		try {
			await deleteUser(userToDelete.id);

			// Invalidate and refetch users query
			queryClient.invalidateQueries({ queryKey: ["users"] });

			// Close dialog
			setDeleteDialogOpen(false);
			setUserToDelete(null);
			// Show success toast
			toast({
				title: "User deleted",
				description: `User "${userToDelete.email}" has been deleted successfully.`,
				variant: "success",
				position: "bottom-center",
				duration: 3000,
			});
		} catch (error: any) {
			console.error("Delete user error:", error);
			let errorMessage = "Failed to delete user";

			if (error?.message) {
				errorMessage = error.message;
			}

			toast({
				title: "Error",
				description: errorMessage,
				variant: "destructive",
				position: "bottom-center",
				duration: 5000,
			});
			setDeleteDialogOpen(false);
			setUserToDelete(null);
		}
	};

	const cancelDeleteUser = () => {
		setDeleteDialogOpen(false);
		setUserToDelete(null);
	};

	const handleViewUser = (userId: number) => {
		setSelectedUserId(userId);
		setIsUserDetailsSheetOpen(true);
	};

	const handleEditUser = (userId: number) => {
		const user = users.find((u) => u.id === userId);
		if (user) {
			setUserToEdit(user);
			setIsEditUserSheetOpen(true);
		}
	};

	const getInitials = (email: string): string => {
		return email.split("@")[0].substring(0, 2).toUpperCase();
	};

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

	const handleSearchChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setLocalSearchTerm(e.target.value);
		},
		[],
	);

	// Convert users from store to ExtendedUser format - memoized to prevent unnecessary recalculations
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
				<div className="text-sm font-mono text-nocta-600 dark:text-nocta-400">
					{user.id}
				</div>
			),
		},
		{
			key: "user",
			title: "User",
			render: (_, user) => (
				<div className="flex items-center gap-3 w-60">
					<Avatar
						className="w-8 h-8"
						size="sm"
						fallback={getInitials(user.email)}
					/>
					<div>
						<div className="font-medium text-nocta-900 dark:text-nocta-100 ">
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
				<Badge className={statusColors[user.status || "active"]}>
					{user.status || "active"}
				</Badge>
			),
		},
		{
			key: "is_verified",
			title: "Verified",
			render: (_, user) => (
				<Badge variant={user.is_verified ? "success" : "secondary"}>
					{user.is_verified ? "Verified" : "Unverified"}
				</Badge>
			),
		},
		{
			key: "locked",
			title: "Locked",
			render: (_, user) => (
				<Badge variant={user.locked ? "destructive" : "secondary"}>
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
						title="Zobacz szczegóły użytkownika"
					>
						<Eye className="w-4 h-4" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="w-8 h-8 p-0"
						onClick={() => handleEditUser(user.id)}
						title="Edytuj użytkownika"
					>
						<Edit3 className="w-4 h-4" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						className="w-8 h-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
						onClick={() => handleDeleteUser(user.id)}
					>
						<Trash2 className="w-4 h-4" />
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
						<UserIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
					</div>
					<h3 className="text-lg font-semibold text-nocta-900 dark:text-nocta-100 mb-2">
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
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-4xl font-bold text-nocta-900 dark:text-nocta-100">
							Users
						</h1>
						<Badge
							variant="secondary"
							className="px-2 py-0.5 text-xs font-medium"
						>
							{totalCount} total
						</Badge>
					</div>
					<p className="text-lg text-nocta-600 dark:text-nocta-400">
						Manage user accounts and permissions
					</p>
				</div>
				<div className="flex items-center gap-3">
					<div className="relative max-w-md">
						<Input
							placeholder="Search users by email..."
							leftIcon={
								<Search className="w-4 h-4 text-nocta-400 dark:text-nocta-500" />
							}
							value={localSearchTerm}
							onChange={handleSearchChange}
							className="pl-10"
						/>
					</div>
					<Button
						className="px-4 py-2"
						onClick={() => setIsCreateUserSheetOpen(true)}
					>
						<UserPlus className="w-4 h-4 mr-2" />
						Create New User
					</Button>
				</div>
			</div>

			{/* Users Table */}
			{extendedUsers.length > 0 || (loading && !data) ? (
				<div className="space-y-4">
					<div className="overflow-x-auto">
						<Table
							columns={columns as any}
							data={extendedUsers as any}
							loading={loading && !data} // Only show spinner on initial load
							pagination={{
								current: currentPage,
								pageSize: pageSize,
								total: totalCount,
								onChange: handlePageChange,
							}}
						/>
					</div>
					{/* Subtle loading indicator for pagination */}
					{loading && data && (
						<div className="flex items-center justify-center py-2">
							<div className="flex items-center gap-2 text-sm text-nocta-500 dark:text-nocta-400">
								<Spinner className="w-4 h-4" />
								<span>Updating...</span>
							</div>
						</div>
					)}
				</div>
			) : (
				<Card>
					<CardContent className="py-12">
						<div className="text-center">
							<div className="p-3 rounded-full bg-nocta-100 dark:bg-nocta-800/30 w-fit mx-auto mb-4">
								<UserIcon className="w-8 h-8 text-nocta-400 dark:text-nocta-500" />
							</div>
							<h3 className="text-lg font-semibold text-nocta-900 dark:text-nocta-100 mb-2">
								{searchTerm ? "No users found" : "No users yet"}
							</h3>
							<p className="text-nocta-600 dark:text-nocta-400 mb-4 max-w-sm mx-auto">
								{searchTerm
									? `No users match "${searchTerm}". Try a different search term.`
									: "Get started by adding your first user account."}
							</p>
							{!searchTerm && (
								<Button onClick={() => setIsCreateUserSheetOpen(true)}>
									<UserPlus className="w-4 h-4 mr-2" />
									Create New User
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Create User Sheet */}
			<CreateUserSheet
				isOpen={isCreateUserSheetOpen}
				onOpenChange={setIsCreateUserSheetOpen}
			/>

			{/* User Details Sheet */}
			<UserDetailsSheet
				isOpen={isUserDetailsSheetOpen}
				onOpenChange={setIsUserDetailsSheetOpen}
				userId={selectedUserId}
			/>

			{/* Edit User Sheet */}
			<EditUserSheet
				isOpen={isEditUserSheetOpen}
				onOpenChange={setIsEditUserSheetOpen}
				user={userToEdit}
			/>

			{/* Delete User Dialog */}
			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
