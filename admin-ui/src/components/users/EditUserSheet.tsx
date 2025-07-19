import { useQueryClient } from "@tanstack/react-query";
import { Save, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/components/ui/toast";
import { CustomApiError } from "@/lib/api";
import { useUsersStore } from "@/stores/users-persist.store";
import type { UpdateUserRequest, User } from "@/types/api";

interface EditUserSheetProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	user: User | null;
}

export function EditUserSheet({
	isOpen,
	onOpenChange,
	user,
}: EditUserSheetProps) {
	const { updateUser, unlockUser } = useUsersStore();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [submitting, setSubmitting] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
	const [formData, setFormData] = useState<UpdateUserRequest>({
		email: "",
		username: "",
		role: "user",
		is_active: true,
	});

	const validateForm = (): boolean => {
		const newErrors: { [key: string]: string } = {};

		if (!formData.email?.trim()) {
			newErrors.email = "Email is required";
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
			newErrors.email = "Please enter a valid email address";
		}

		if (
			formData.username &&
			formData.username.trim() &&
			!/^[a-zA-Z0-9_]+$/.test(formData.username)
		) {
			newErrors.username =
				"Username can only contain letters, numbers, and underscores";
		}

		if (!formData.role) {
			newErrors.role = "Role is required";
		}

		setFieldErrors(newErrors);

		if (Object.keys(newErrors).length > 0) {
			toast({
				title: "Validation Error",
				description: "Please fix the validation errors in the form",
				variant: "destructive",
				position: "bottom-center",
				duration: 3000,
			});
		}

		return Object.keys(newErrors).length === 0;
	};

	const handleUpdateUser = async () => {
		if (!user || !validateForm()) return;

		setSubmitting(true);

		try {
			const userData: UpdateUserRequest = {
				email: formData.email?.trim(),
				username: formData.username?.trim() || undefined,
				role: formData.role,
				is_active: formData.is_active,
			};

			await updateUser(user.id, userData);

			// Invalidate and refetch users query
			queryClient.invalidateQueries({ queryKey: ["users"] });

			onOpenChange(false);

			toast({
				title: "Success!",
				description: `User "${formData.email}" has been updated successfully.`,
				variant: "success",
				position: "bottom-center",
				duration: 3000,
			});
		} catch (error) {
			console.error("User update error:", error);

			let errorMessage = "Failed to update user";

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
			setSubmitting(false);
		}
	};

	const updateFormData = (
		field: keyof UpdateUserRequest,
		value: string | boolean,
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		// Clear field error when user starts typing
		if (fieldErrors[field]) {
			setFieldErrors((prev) => ({ ...prev, [field]: "" }));
		}
	};

	const handleUnlockUser = async () => {
		if (!user) return;

		setSubmitting(true);

		try {
			await unlockUser(user.id);

			// Invalidate and refetch users query
			queryClient.invalidateQueries({ queryKey: ["users"] });

			onOpenChange(false);

			toast({
				title: "User unlocked",
				description: `User "${user.email}" has been unlocked successfully.`,
				variant: "success",
				position: "bottom-center",
				duration: 3000,
			});
		} catch (error: any) {
			console.error("Unlock user error:", error);
			let errorMessage = "Failed to unlock user";

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
		} finally {
			setSubmitting(false);
		}
	};

	// Check if user is locked
	const isUserLocked = user?.locked_until
		? new Date(user.locked_until) > new Date()
		: false;

	// Initialize form when user changes or sheet opens
	useEffect(() => {
		if (isOpen && user) {
			setFormData({
				email: user.email || "",
				username: user.username || "",
				role: user.role || "user",
				is_active: user.is_active ?? true,
			});
			setFieldErrors({});
		}
	}, [isOpen, user]);

	return (
		<Sheet open={isOpen} onOpenChange={onOpenChange}>
			<SheetContent side="right" size="lg">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						<UserIcon className="w-5 h-5" />
						Edit User
					</SheetTitle>
					<SheetDescription>Update user account information</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<Form
						onSubmit={(e) => {
							e.preventDefault();
							handleUpdateUser();
						}}
					>
						<div className="space-y-6">
							{/* Email */}
							<FormField name="email" error={fieldErrors.email}>
								<FormLabel required>Email Address</FormLabel>
								<FormControl>
									<Input
										type="email"
										placeholder="user@example.com"
										className="w-full"
										value={formData.email || ""}
										onChange={(e) => updateFormData("email", e.target.value)}
										variant={fieldErrors.email ? "error" : "default"}
									/>
								</FormControl>
								<FormDescription>
									This will be used for login and notifications
								</FormDescription>
								<FormMessage />
							</FormField>

							{/* Username */}
							<FormField name="username" error={fieldErrors.username}>
								<FormLabel>Username</FormLabel>
								<FormControl>
									<Input
										placeholder="Optional display name"
										className="w-full"
										value={formData.username || ""}
										onChange={(e) => updateFormData("username", e.target.value)}
										variant={fieldErrors.username ? "error" : "default"}
									/>
								</FormControl>
								<FormDescription>
									Optional. Can contain letters, numbers, and underscores
								</FormDescription>
								<FormMessage />
							</FormField>

							{/* Role */}
							<FormField name="role" error={fieldErrors.role}>
								<FormLabel required>Role</FormLabel>
								<FormControl>
									<Select
										value={formData.role}
										onValueChange={(value) => {
											if (value) {
												updateFormData(
													"role",
													value as "admin" | "user" | "guest",
												);
											}
										}}
									>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="Select a role" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="user">User</SelectItem>
											<SelectItem value="admin">Admin</SelectItem>
											<SelectItem value="guest">Guest</SelectItem>
										</SelectContent>
									</Select>
								</FormControl>
								<FormDescription>
									Determines the user's permissions in the system
								</FormDescription>
								<FormMessage />
							</FormField>

							{/* Active Status */}
							<FormField name="is_active">
								<div className="flex items-center justify-between">
									<div className="space-y-0.5">
										<FormLabel>Active Status</FormLabel>
										<FormDescription>
											Inactive users cannot log in to the system
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={formData.is_active ?? true}
											onCheckedChange={(checked) =>
												updateFormData("is_active", checked)
											}
										/>
									</FormControl>
								</div>
							</FormField>

							{/* Unlock User - only show if user is locked */}
							{isUserLocked && (
								<div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
									<div className="flex items-center justify-between">
										<div className="space-y-1">
											<h4 className="text-sm font-medium text-red-900 dark:text-red-100">
												User Account Locked
											</h4>
											<p className="text-sm text-red-700 dark:text-red-300">
												This user account is currently <br /> locked until{" "}
												{user?.locked_until
													? new Date(user.locked_until).toLocaleString()
													: "unknown"}
												.
											</p>
										</div>
										<Button
											type="button"
											variant="primary"
											size="sm"
											onClick={handleUnlockUser}
											disabled={submitting}
											className=""
										>
											{submitting ? (
												<>
													<Spinner size="sm" className="mr-2" />
													Unlocking...
												</>
											) : (
												"Unlock"
											)}
										</Button>
									</div>
								</div>
							)}
						</div>
					</Form>
				</div>

				<SheetFooter>
					<SheetClose asChild>
						<Button variant="ghost">Cancel</Button>
					</SheetClose>
					<Button
						type="submit"
						disabled={submitting}
						onClick={handleUpdateUser}
					>
						{submitting ? (
							<>
								<Spinner size="sm" className="mr-2" />
								Updating...
							</>
						) : (
							<>
								<Save className="w-4 h-4 mr-2" />
								Update User
							</>
						)}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
