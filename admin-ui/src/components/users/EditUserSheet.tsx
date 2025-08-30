import { FloppyDiskIcon } from "@phosphor-icons/react";
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
import { toast } from "@/components/ui/toast";
import { useUnlockUser, useUpdateUser } from "@/hooks";
import type { UpdateUserRequest, User } from "@/types/api";
import {
	userFieldDescriptions,
	userRoleOptions,
} from "./constants";
import { validateUpdateUserData } from "./validation";

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
	const updateUserMutation = useUpdateUser();
	const unlockUserMutation = useUnlockUser();
	const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
	const [allowClose, setAllowClose] = useState(true);
	const [formData, setFormData] = useState<UpdateUserRequest>({
		email: "",
		username: "",
		role: "user",
		is_active: true,
	});

	const validateForm = (): boolean => {
		const dataToValidate: UpdateUserRequest = {
			email: formData.email?.trim(),
			username: formData.username?.trim() || undefined,
			role: formData.role,
			is_active: formData.is_active,
		};

		const result = validateUpdateUserData(dataToValidate);

		if (result.success) {
			setFieldErrors({});
			return true;
		} else {
			setFieldErrors(result.fieldErrors);
			toast({
				title: "Validation Error",
				description: "Please fix the validation errors in the form",
				variant: "destructive",
				position: "bottom-right",
				duration: 3000,
			});
			return false;
		}
	};

	const handleUpdateUser = async () => {
		if (!user || !validateForm()) return;

		const userData: UpdateUserRequest = {
			email: formData.email?.trim(),
			username: formData.username?.trim() || undefined,
			role: formData.role,
			is_active: formData.is_active,
		};

		updateUserMutation.mutate(
			{ id: user.id, data: userData },
			{
				onSuccess: () => {
					onOpenChange(false);
				},
				onError: () => {},
			},
		);
	};

	const updateFormData = (
		field: keyof UpdateUserRequest,
		value: string | boolean,
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }));

		if (fieldErrors[field]) {
			setFieldErrors((prev) => ({ ...prev, [field]: "" }));
		}
	};

	const handleUnlockUser = async () => {
		if (!user) return;

		unlockUserMutation.mutate(user.id, {
			onSuccess: () => {
				onOpenChange(false);
			},
			onError: () => {},
		});
	};

	const isUserLocked = user?.locked_until
		? new Date(user.locked_until) > new Date()
		: false;

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
		<Sheet
			open={isOpen}
			onOpenChange={(newOpen) => {
				if (
					!newOpen &&
					(!allowClose ||
						updateUserMutation.isPending ||
						unlockUserMutation.isPending)
				) {
					return;
				}

				onOpenChange(newOpen);
				if (newOpen) {
					setAllowClose(true);
				}
			}}
		>
			<SheetContent side="right" size="lg">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">Edit User</SheetTitle>
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
								<FormDescription>{userFieldDescriptions.email}</FormDescription>
								<FormMessage />
							</FormField>

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
									{userFieldDescriptions.username}
								</FormDescription>
								<FormMessage />
							</FormField>

							<FormField name="role" error={fieldErrors.role}>
								<FormLabel required>Role</FormLabel>
								<FormControl>
									<Select
										portalProps={
											{
												"data-sheet-portal": "true",
											} as React.HTMLAttributes<HTMLDivElement>
										}
										value={formData.role}
										onValueChange={(value) => {
											if (value) {
												setAllowClose(false);
												updateFormData(
													"role",
													value as "admin" | "user" | "guest",
												);

												setTimeout(() => setAllowClose(true), 300);
											}
										}}
										onOpenChange={(isOpen) => {
											if (isOpen) {
												setAllowClose(false);
											}
										}}
									>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="Select a role" />
										</SelectTrigger>
										<SelectContent>
											{userRoleOptions.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</FormControl>
								<FormDescription>{userFieldDescriptions.role}</FormDescription>
								<FormMessage />
							</FormField>

							<FormField name="is_active">
								<div className="flex items-center justify-between">
									<div className="space-y-0.5">
										<FormLabel>Active Status</FormLabel>
										<FormDescription>
											{userFieldDescriptions.isActive}
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

							{isUserLocked && (
								<div className="p-4 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
									<div className="flex items-center justify-between">
										<div className="space-y-1">
											<h4 className="text-sm font-light text-red-900 dark:text-red-100">
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
											disabled={unlockUserMutation.isPending}
											className=""
										>
											{unlockUserMutation.isPending ? (
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
						disabled={updateUserMutation.isPending}
						onClick={handleUpdateUser}
					>
						{updateUserMutation.isPending ? (
							<>
								<Spinner size="sm" className="mr-2" />
								Updating...
							</>
						) : (
						<>
							<FloppyDiskIcon size={16} />
							<span className="ml-2">Update User</span>
						</>
						)}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
