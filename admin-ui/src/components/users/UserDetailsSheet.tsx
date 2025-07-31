import { Calendar, Clock, Lock, Mail, Shield, XCircle } from "lucide-react";
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
	// Check if it's an external URL that needs proxying
	if (originalUrl.startsWith('https://lh3.googleusercontent.com') || 
		originalUrl.startsWith('https://avatars.githubusercontent.com')) {
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
					<SheetDescription>View user account information</SheetDescription>
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
						<div className="space-y-6">
							{/* User Avatar and Basic Info */}
							<div className="flex items-center gap-4 p-4 bg-nocta-50 dark:bg-nocta-800/30 rounded-lg">
								<Avatar 
									size="lg" 
									src={user?.avatar_url ? getProxyUrl(user.avatar_url) : undefined}
									fallback={getInitials(user.email)} />
								<div className="flex-1">
									<h3 className="text-xl font-semibold text-nocta-900 dark:text-nocta-100">
										{user.username || user.email}
									</h3>
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

							{/* User Details */}
							<div className="space-y-3">
								<h4 className="text-lg font-medium text-nocta-900 dark:text-nocta-100">
									Account Information
								</h4>

								{/* Email */}
								<div className="flex items-center gap-3 p-4 bg-nocta-100 dark:bg-nocta-800/30 rounded-md">
									<Mail className="h-6 w-6 text-nocta-500" />
									<div>
										<p className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
											Email
										</p>
										<p className="text-sm text-nocta-900 dark:text-nocta-100">
											{user.email}
										</p>
									</div>
								</div>

								{/* Role */}
								<div className="flex items-center gap-3 p-4 bg-nocta-100 dark:bg-nocta-800/30 rounded-md">
									<Shield className="h-6 w-6 text-nocta-500" />
									<div>
										<p className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
											Role
										</p>
										<p className="text-sm text-nocta-900 dark:text-nocta-100">
											{user.role}
										</p>
									</div>
								</div>

								{/* Last Login */}
								<div className="flex items-center gap-3 p-4 bg-nocta-100 dark:bg-nocta-800/30 rounded-md">
									<Clock className="h-6 w-6 text-nocta-500" />
									<div>
										<p className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
											Last Login
										</p>
										<p className="text-sm text-nocta-900 dark:text-nocta-100">
											{user.last_login_at
												? formatDate(user.last_login_at)
												: "Never"}
										</p>
									</div>
								</div>

								{/* Created At */}
								<div className="flex items-center gap-3 p-4 bg-nocta-100 dark:bg-nocta-800/30 rounded-md">
									<Calendar className="h-6 w-6 text-nocta-500" />
									<div>
										<p className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
											Created At
										</p>
										<p className="text-sm text-nocta-900 dark:text-nocta-100">
											{formatDate(user.created_at)}
										</p>
									</div>
								</div>

								{/* Updated At */}
								{user.updated_at && (
									<div className="flex items-center gap-3">
										<Calendar className="h-6 w-6 text-nocta-500" />
										<div>
											<p className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
												Last Updated
											</p>
											<p className="text-nocta-900 dark:text-nocta-100">
												{formatDate(user.updated_at)}
											</p>
										</div>
									</div>
								)}

								{user.locked_until && (
									<div className="flex items-center gap-3 p-4 bg-nocta-100 dark:bg-nocta-800/30 rounded-md">
										<Lock className="h-6 w-6 text-nocta-500" />
										<div>
											<p className="text-sm font-medium text-nocta-600 dark:text-nocta-400">
												Locked Until
											</p>
											<p className="text-sm text-nocta-900 dark:text-nocta-100">
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
						<Button variant="primary">Close</Button>
					</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
