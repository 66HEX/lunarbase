import { useQueryClient } from "@tanstack/react-query";
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
import { useToast } from "@/components/ui/toast";
import { CustomApiError } from "@/lib/api";
import { useUsersStore } from "@/stores/users-persist.store";
import type { CreateUserRequest } from "@/types/api";

interface CreateUserSheetProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateUserSheet({
	isOpen,
	onOpenChange,
}: CreateUserSheetProps) {
	const { createUser } = useUsersStore();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [submitting, setSubmitting] = useState(false);
	const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
	const [formData, setFormData] = useState<CreateUserRequest>({
		email: "",
		password: "",
		username: "",
		role: "user",
	});

	const validateForm = (): boolean => {
		const newErrors: { [key: string]: string } = {};

		if (!formData.email.trim()) {
			newErrors.email = "Email is required";
		} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
			newErrors.email = "Please enter a valid email address";
		}

		if (!formData.password.trim()) {
			newErrors.password = "Password is required";
		} else if (formData.password.length < 8) {
			newErrors.password = "Password must be at least 8 characters long";
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

	const handleCreateUser = async () => {
		if (!validateForm()) return;

		setSubmitting(true);

		try {
			const userData: CreateUserRequest = {
				email: formData.email.trim(),
				password: formData.password,
				username: formData.username?.trim() || undefined,
				role: formData.role,
			};

			await createUser(userData);

			// Invalidate and refetch users query
			queryClient.invalidateQueries({ queryKey: ["users"] });

			// Reset form and close sheet
			setFormData({
				email: "",
				password: "",
				username: "",
				role: "user",
			});
			setFieldErrors({});
			onOpenChange(false);

			toast({
				title: "Success!",
				description: `User "${formData.email}" has been created successfully.`,
				variant: "success",
				position: "bottom-center",
				duration: 3000,
			});
		} catch (error) {
			console.error("User creation error:", error);

			let errorMessage = "Failed to create user";

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
			setFormData({
				email: "",
				password: "",
				username: "",
				role: "user",
			});
			setFieldErrors({});
		}
	}, [isOpen]);

	return (
		<Sheet open={isOpen} onOpenChange={onOpenChange}>
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
										value={formData.username}
										onChange={(e) => updateFormData("username", e.target.value)}
										variant={fieldErrors.username ? "error" : "default"}
									/>
								</FormControl>
								<FormDescription>
									Optional. Can contain letters, numbers, and underscores
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
									Must be at least 8 characters long
								</FormDescription>
								<FormMessage />
							</FormField>

							{/* Role */}
							<FormField name="role" error={fieldErrors.role}>
								<FormLabel required>Role</FormLabel>
								<FormControl>
									<Select
										value={formData.role}
										onValueChange={(value) =>
											updateFormData("role", value as CreateUserRequest["role"])
										}
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
						onClick={handleCreateUser}
					>
						{submitting ? (
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
