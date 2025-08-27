import { XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
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
import { usersApi } from "@/lib/api";
import type { User } from "@/types/api";

interface UserDetailsSheetProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	userId: number | null;
}

interface ExtendedUser extends Omit<User, "role"> {
	status: "active" | "inactive";
	locked: boolean;
	role: "admin" | "user" | "guest";
}

const statusVariants: Record<
	string,
	"destructive" | "secondary" | "success" | "warning" | "outline" | "default"
> = {
	active: "success" as const,
	inactive: "warning" as const,
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

export function UserDetailsSheet({
	isOpen,
	onOpenChange,
	userId,
}: UserDetailsSheetProps) {
	const [user, setUser] = useState<ExtendedUser | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const getInitials = (email: string): string => {
		return email.split("@")[0].substring(0, 2).toUpperCase();
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

	const fetchUserDetails = async (id: number) => {
		setLoading(true);
		setError(null);

		try {
			const userData = await usersApi.get(id);
			const extendedUser: ExtendedUser = {
				...userData,
				status: userData.is_active ? "active" : "inactive",
				locked: userData.locked_until
					? new Date(userData.locked_until) > new Date()
					: false,
				role: userData.role as "admin" | "user" | "guest",
			};
			setUser(extendedUser);
		} catch (err: unknown) {
			setError(
				err instanceof Error ? err.message : "Failed to fetch user data",
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (isOpen && userId) {
			fetchUserDetails(userId);
		} else {
			setUser(null);
			setError(null);
		}
	}, [isOpen, userId]);

	return (
		<Sheet open={isOpen} onOpenChange={onOpenChange}>
			<SheetContent side="right" size="lg">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						User Details
					</SheetTitle>
					<SheetDescription>
						View user account information and details
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					{loading ? (
						<div className="flex items-center justify-center py-8">
							<div className="text-center">
								<Spinner className="w-8 h-8 mx-auto mb-4" />
								<p className="text-nocta-600 dark:text-nocta-400">
									Loading user data...
								</p>
							</div>
						</div>
					) : error ? (
						<div className="flex items-center justify-center py-8">
							<div className="text-center">
								<XCircle className="w-8 h-8 mx-auto mb-4 text-nocta-500" />
								<p className="text-nocta-600 dark:text-nocta-400">{error}</p>
							</div>
						</div>
					) : user ? (
						<div className="space-y-4">
							<div className="p-4 bg-nocta-100 dark:bg-nocta-800/30 rounded-lg space-y-4">
								<div className="flex items-center gap-4">
									<Avatar
										size="lg"
										src={
											user?.avatar_url ? getProxyUrl(user.avatar_url) : undefined
										}
										fallback={getInitials(user.email)}
									/>
									<div className="flex-1">
										<h4 className="text-lg font-medium text-nocta-900 dark:text-nocta-100">
											{user.username || user.email}
										</h4>
										<div className="flex items-center gap-2 mt-2">
											<Badge size="sm" variant={statusVariants[user.status]}>
												{user.status === "active" ? "Active" : "Inactive"}
											</Badge>
											{user.is_verified && (
												<Badge size="sm" variant="success">
													Verified
												</Badge>
											)}
											{user.locked && (
												<Badge size="sm" variant="destructive">
													Locked
												</Badge>
											)}
										</div>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
											Email
										</label>
										<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
											{user.email}
										</p>
									</div>
									<div>
										<label className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
											Role
										</label>
										<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
											{user.role}
										</p>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
											Created
										</label>
										<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
											{formatDate(user.created_at)}
										</p>
									</div>
									<div>
										<label className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
											Last Login
										</label>
										<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
											{user.last_login_at ? formatDate(user.last_login_at) : "Never"}
										</p>
									</div>
								</div>
								{user.updated_at && (
									<div className="grid grid-cols-1 gap-4">
										<div>
											<label className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
												Last Updated
											</label>
											<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
												{formatDate(user.updated_at)}
											</p>
										</div>
									</div>
								)}
								{user.locked_until && (
									<div className="grid grid-cols-1 gap-4">
										<div>
											<label className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
												Locked Until
											</label>
											<p className="text-sm text-nocta-900 dark:text-nocta-100 mt-1">
												{formatDate(user.locked_until)}
											</p>
										</div>
									</div>
								)}
							</div>
						</div>
					) : null}
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
