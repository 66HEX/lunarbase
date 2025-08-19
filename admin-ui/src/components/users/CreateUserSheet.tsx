import { Save } from "lucide-react";
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
import { toast } from "@/components/ui/toast";
import { useCreateUser } from "@/hooks";
import type { CreateUserRequest } from "@/types/api";
import {
	defaultUserFormData,
	userFieldDescriptions,
	userRoleOptions,
	userValidationMessages,
	userValidationPatterns,
} from "./constants";

interface CreateUserSheetProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateUserSheet({
	isOpen,
	onOpenChange,
}: CreateUserSheetProps) {
	const createUserMutation = useCreateUser();

	const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
	const [allowClose, setAllowClose] = useState(true);
	const [formData, setFormData] =
		useState<CreateUserRequest>(defaultUserFormData);

	const validateForm = (): boolean => {
		const newErrors: { [key: string]: string } = {};

		if (!formData.email.trim()) {
			newErrors.email = userValidationMessages.email.required;
		} else if (!userValidationPatterns.email.test(formData.email)) {
			newErrors.email = userValidationMessages.email.invalid;
		}

		if (!formData.password.trim()) {
			newErrors.password = userValidationMessages.password.required;
		} else if (formData.password.length < 8) {
			newErrors.password = userValidationMessages.password.minLength;
		}

		if (
			formData.username &&
			formData.username.trim() &&
			!userValidationPatterns.username.test(formData.username)
		) {
			newErrors.username = userValidationMessages.username.invalid;
		}

		if (!formData.role) {
			newErrors.role = userValidationMessages.role.required;
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

	const handleCreateUser = async () => {
		if (!validateForm()) return;

		const userData: CreateUserRequest = {
			email: formData.email.trim(),
			password: formData.password,
			username: formData.username?.trim() || undefined,
			role: formData.role,
		};

		createUserMutation.mutate(userData, {
			onSuccess: () => {
				// Reset form and close sheet
				setFormData(defaultUserFormData);
				setFieldErrors({});
				onOpenChange(false);
			},
			onError: () => {
				// Error handling is done in the mutation hook
			},
		});
	};

	const updateFormData = (field: keyof CreateUserRequest, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		// Clear field error when user starts typing
		if (fieldErrors[field]) {
			setFieldErrors((prev) => ({ ...prev, [field]: "" }));
		}
	};

	// Reset form when sheet opens
	useEffect(() => {
		if (isOpen) {
			setFormData(defaultUserFormData);
			setFieldErrors({});
		}
	}, [isOpen]);

	return (
		<Sheet
			open={isOpen}
			onOpenChange={(newOpen) => {
				// Only allow closing if explicitly allowed and not submitting
				if (!newOpen && (!allowClose || createUserMutation.isPending)) {
					// Prevent closing - do nothing
					return;
				}
				// Allow opening or closing when conditions are met
				onOpenChange(newOpen);
				if (newOpen) {
					setAllowClose(true); // Allow closing when opening
				}
			}}
		>
			<SheetContent side="right" size="lg">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						Create User
					</SheetTitle>
					<SheetDescription>
						Add a new user account to the system
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<Form
						onSubmit={(e) => {
							e.preventDefault();
							handleCreateUser();
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
										value={formData.email}
										onChange={(e) => updateFormData("email", e.target.value)}
										variant={fieldErrors.email ? "error" : "default"}
									/>
								</FormControl>
								<FormDescription>{userFieldDescriptions.email}</FormDescription>
								<FormMessage />
							</FormField>

							{/* Username */}
							<FormField name="username" error={fieldErrors.username}>
								<FormLabel>Username</FormLabel>
								<FormControl>
									<Input
										placeholder="Optional display name"
										className="w-full"
										value={formData.username}
										onChange={(e) => updateFormData("username", e.target.value)}
										variant={fieldErrors.username ? "error" : "default"}
									/>
								</FormControl>
								<FormDescription>
									{userFieldDescriptions.username}
								</FormDescription>
								<FormMessage />
							</FormField>

							{/* Password */}
							<FormField name="password" error={fieldErrors.password}>
								<FormLabel required>Password</FormLabel>
								<FormControl>
									<Input
										type="password"
										placeholder="Enter a secure password"
										className="w-full"
										value={formData.password}
										onChange={(e) => updateFormData("password", e.target.value)}
										variant={fieldErrors.password ? "error" : "default"}
									/>
								</FormControl>
								<FormDescription>
									{userFieldDescriptions.password}
								</FormDescription>
								<FormMessage />
							</FormField>

							{/* Role */}
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
												// Prevent sheet from closing during value change
												setAllowClose(false);
												updateFormData(
													"role",
													value as CreateUserRequest["role"],
												);
												// Allow closing after a longer delay
												setTimeout(() => setAllowClose(true), 300);
											}
										}}
										onOpenChange={(isOpen) => {
											// Prevent sheet from closing when select is open
											if (isOpen) {
												setAllowClose(false);
											}
											// Don't restore allowClose here - let onValueChange handle it
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
						</div>
					</Form>
				</div>

				<SheetFooter>
					<SheetClose asChild>
						<Button variant="ghost">Cancel</Button>
					</SheetClose>
					<Button
						type="submit"
						disabled={createUserMutation.isPending}
						onClick={handleCreateUser}
					>
						{createUserMutation.isPending ? (
							<>
								<Spinner size="sm" className="mr-2" />
								Creating...
							</>
						) : (
							<>
								<Save className="w-4 h-4 mr-2" />
								Create User
							</>
						)}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
