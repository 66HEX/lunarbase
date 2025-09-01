import { FloppyDiskIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { useUpdateRole } from "@/hooks/permissions/useRoleMutations";
import type { Role, UpdateRoleRequest } from "@/types/api";
import { roleFieldDescriptions, rolePriorityOptions } from "./constants";
import { validateUpdateRoleData } from "./validation";

interface EditRoleSheetProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	role: Role | null;
}

export function EditRoleSheet({
	isOpen,
	onOpenChange,
	role,
}: EditRoleSheetProps) {
	const updateRoleMutation = useUpdateRole();
	const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
	const [allowClose, setAllowClose] = useState(true);
	const allowCloseRef = useRef(setAllowClose);
	const [formData, setFormData] = useState<UpdateRoleRequest>({
		name: "",
		description: "",
		priority: 50,
	});

	const validateForm = (): boolean => {
		const dataToValidate: UpdateRoleRequest = {
			name: formData.name?.trim(),
			description: formData.description?.trim() || undefined,
			priority: formData.priority,
		};

		const result = validateUpdateRoleData(dataToValidate);

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

	const handleUpdateRole = async () => {
		if (!role || !validateForm()) return;

		if (role.name === "admin" && formData.name && formData.name !== "admin") {
			toast({
				title: "Cannot modify admin role",
				description: "The admin role name cannot be changed",
				variant: "destructive",
				position: "bottom-right",
				duration: 3000,
			});
			return;
		}

		const roleData: UpdateRoleRequest = {
			name: formData.name?.trim(),
			description: formData.description?.trim() || undefined,
			priority: formData.priority,
		};

		updateRoleMutation.mutate(
			{ roleName: role.name, data: roleData },
			{
				onSuccess: () => {
					onOpenChange(false);
				},
				onError: () => {},
			},
		);
	};

	const updateFormData = (
		field: keyof UpdateRoleRequest,
		value: string | number | undefined,
	) => {
		setFormData((prev) => ({ ...prev, [field]: value }));

		if (fieldErrors[field]) {
			setFieldErrors((prev) => ({ ...prev, [field]: "" }));
		}
	};

	const isAdminRole = role?.name === "admin";

	useEffect(() => {
		allowCloseRef.current = setAllowClose;
	}, [setAllowClose]);

	useEffect(() => {
		if (isOpen && role) {
			setFormData({
				name: role.name || "",
				description: role.description || "",
				priority: role.priority || 50,
			});
			setFieldErrors({});
		}
	}, [isOpen, role]);

	return (
		<Sheet
			open={isOpen}
			onOpenChange={(newOpen) => {
				if (!newOpen && (!allowClose || updateRoleMutation.isPending)) {
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
					<SheetTitle className="flex items-center gap-2">Edit Role</SheetTitle>
					<SheetDescription>
						Update role information and priority
					</SheetDescription>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					<Form
						onSubmit={(e) => {
							e.preventDefault();
							handleUpdateRole();
						}}
					>
						<div className="space-y-6">
							<FormField name="name" error={fieldErrors.name}>
								<FormLabel required>Role Name</FormLabel>
								<FormControl>
									<Input
										placeholder="e.g., editor, moderator, viewer"
										className="w-full"
										value={formData.name || ""}
										onChange={(e) => updateFormData("name", e.target.value)}
										variant={fieldErrors.name ? "error" : "default"}
										disabled={isAdminRole}
									/>
								</FormControl>
								<FormDescription>
									{isAdminRole
										? "Admin role name cannot be changed"
										: roleFieldDescriptions.name}
								</FormDescription>
								<FormMessage />
							</FormField>

							<FormField name="description" error={fieldErrors.description}>
								<FormLabel>Description</FormLabel>
								<FormControl>
									<Textarea
										placeholder="Describe what this role is for..."
										className="w-full"
										value={formData.description || ""}
										onChange={(e) =>
											updateFormData("description", e.target.value)
										}
										variant={fieldErrors.description ? "error" : "default"}
										rows={3}
									/>
								</FormControl>
								<FormDescription>
									{roleFieldDescriptions.description}
								</FormDescription>
								<FormMessage />
							</FormField>

							<FormField name="priority" error={fieldErrors.priority}>
								<FormLabel required>Priority</FormLabel>
								<FormControl>
									<Select
										portalProps={
											{
												"data-sheet-portal": "true",
											} as React.HTMLAttributes<HTMLDivElement>
										}
										value={formData.priority?.toString() || "50"}
										onValueChange={(value) => {
											if (value) {
												updateFormData("priority", parseInt(value, 10));
											}
										}}
										allowCloseRef={allowCloseRef}
										disabled={isAdminRole}
									>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="Select priority level" />
										</SelectTrigger>
										<SelectContent>
											{rolePriorityOptions.map((option) => (
												<SelectItem
													key={option.value}
													value={option.value.toString()}
												>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</FormControl>
								<FormDescription>
									{isAdminRole
										? "Admin role priority cannot be changed"
										: roleFieldDescriptions.priority}
								</FormDescription>
								<FormMessage />
							</FormField>

							{isAdminRole && (
								<div className="p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20">
									<div className="space-y-1">
										<h4 className="text-sm font-light text-blue-900 dark:text-blue-100">
											Protected Role
										</h4>
										<p className="text-sm text-blue-700 dark:text-blue-300">
											This is the admin role. The name cannot be changed to
											maintain system security.
										</p>
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
						disabled={updateRoleMutation.isPending}
						onClick={handleUpdateRole}
					>
						{updateRoleMutation.isPending ? (
							<>
								<Spinner size="sm" className="mr-2" />
								Updating...
							</>
						) : (
							<>
								<FloppyDiskIcon size={16} />
								<span className="ml-2">Update Role</span>
							</>
						)}
					</Button>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
