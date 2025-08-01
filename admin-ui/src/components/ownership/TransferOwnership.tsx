import { UserPen } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogActions,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useTransferOwnership } from "@/hooks/ownership/useOwnershipMutations";
import { useUsers } from "@/hooks/users/useUsers";
import type { User } from "@/types/api";

interface TransferOwnershipProps {
	collectionName: string;
	recordId: number;
	currentOwnerId?: number;
	trigger?: React.ReactNode;
	onSuccess?: () => void;
}

export function TransferOwnership({
	collectionName,
	recordId,
	currentOwnerId,
	trigger,
	onSuccess,
}: TransferOwnershipProps) {
	const [open, setOpen] = useState(false);
	const [selectedUserId, setSelectedUserId] = useState<string>("");
	const [allowClose, setAllowClose] = useState(true);

	// Fetch users for selection
	const { data: usersResponse, isLoading: isLoadingUsers } = useUsers({
		limit: 100, // Get first 100 users
	});

	// Transfer ownership mutation
	const transferOwnership = useTransferOwnership();

	const users = usersResponse?.users || [];

	// Filter out current owner from the list
	const availableUsers = users.filter(
		(user: User) => user.id !== currentOwnerId,
	);

	const handleTransfer = async () => {
		if (!selectedUserId) return;

		try {
			await transferOwnership.mutateAsync({
				collectionName,
				recordId,
				data: { new_owner_id: parseInt(selectedUserId) },
			});

			// Close dialog and reset form
			setAllowClose(true);
			setOpen(false);
			setSelectedUserId("");
			onSuccess?.();
		} catch (error) {
			// Error is handled by the mutation hook
			console.error("Transfer failed:", error);
		}
	};

	const handleCancel = () => {
		setAllowClose(true);
		setOpen(false);
		setSelectedUserId("");
	};

	const defaultTrigger = (
		<Button variant="primary" size="sm">
			<UserPen className="w-4 h-4 mr-2" />
			Transfer
		</Button>
	);

	const getProxyUrl = (originalUrl: string): string => {
		// Check if it's an external URL that needs proxying
		if (
			originalUrl.startsWith("https://lh3.googleusercontent.com") ||
			originalUrl.startsWith("https://avatars.githubusercontent.com")
		) {
			const proxyUrl = `/api/avatar-proxy?url=${encodeURIComponent(originalUrl)}`;
			return proxyUrl;
		}
		return originalUrl;
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(newOpen) => {
				// Only allow closing if explicitly allowed or not pending transfer
				if (!newOpen && (allowClose || !transferOwnership.isPending)) {
					setOpen(newOpen);
					setAllowClose(true); // Reset for next time
				} else if (newOpen) {
					setOpen(newOpen);
					setAllowClose(true); // Allow closing when opening
				}
			}}
		>
			<DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
			<DialogContent size="lg" className="min-w-120">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						Transfer Ownership
					</DialogTitle>
					<DialogDescription>
						Select a new owner for this record in{" "}
						<span className="font-medium">{collectionName}</span>.
					</DialogDescription>
				</DialogHeader>
				<div className="flex-1 overflow-y-auto px-6 py-4">
					<div className="space-y-2">
						<label className="text-sm font-medium text-gray-700 dark:text-gray-300">
							New Owner
						</label>
						{isLoadingUsers ? (
							<div className="flex items-center justify-center py-4">
								<Spinner size="sm" />
								<span className="ml-2 text-sm text-gray-500">
									Loading users...
								</span>
							</div>
						) : (
							<Select
								portalProps={
									{
										"data-dialog-portal": "true",
									} as React.HTMLAttributes<HTMLDivElement>
								}
								value={selectedUserId}
								onValueChange={setSelectedUserId}
								onOpenChange={(isOpen) => {
									// Prevent dialog from closing when select is open or closing
									if (isOpen) {
										setAllowClose(false);
									} else {
										// Keep dialog open even when select closes
										setTimeout(() => setAllowClose(true), 100);
									}
								}}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Select a user" />
								</SelectTrigger>
								<SelectContent>
									{availableUsers.length === 0 ? (
										<SelectItem value="" disabled>
											No other users available
										</SelectItem>
									) : (
										availableUsers.map((user: User) => (
											<SelectItem key={user.id} value={user.id.toString()}>
												<div className="flex items-center gap-2">
													<Avatar
														size="sm"
														src={
															user?.avatar_url
																? getProxyUrl(user.avatar_url)
																: undefined
														}
														fallback={
															user?.username
																? user.username.substring(0, 2).toUpperCase()
																: "U"
														}
													/>
													<div className="flex flex-col">
														<span className="text-sm font-medium">
															{user.username || user.email}
														</span>
														{user.username && (
															<span className="text-xs text-gray-500">
																{user.email}
															</span>
														)}
													</div>
													<span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
														{user.role}
													</span>
												</div>
											</SelectItem>
										))
									)}
								</SelectContent>
							</Select>
						)}
					</div>
				</div>
				<DialogFooter>
					<DialogActions>
						<DialogClose asChild>
							<Button
								variant="ghost"
								onClick={handleCancel}
								disabled={transferOwnership.isPending}
							>
								Cancel
							</Button>
						</DialogClose>
						<Button
							variant="primary"
							onClick={handleTransfer}
							disabled={!selectedUserId || transferOwnership.isPending}
						>
							{transferOwnership.isPending ? (
								<>
									<Spinner size="sm" className="mr-2" />
									Transferring...
								</>
							) : (
								"Transfer Ownership"
							)}
						</Button>
					</DialogActions>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
