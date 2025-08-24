import { Shield, UserCheck, User as UserIcon, UserX } from "lucide-react";

export const userRoleOptions = [
	{ value: "user", label: "User" },
	{ value: "admin", label: "Admin" },
];

export const userRoleIcons = {
	user: UserIcon,
	admin: Shield,
};

export const userStatusIcons = {
	active: UserCheck,
	inactive: UserX,
	locked: UserX,
};

export const getUserRoleVariant = (role: string) => {
	const variants: {
		[key: string]:
			| "default"
			| "secondary"
			| "destructive"
			| "success"
			| "warning"
			| "outline";
	} = {
		user: "default",
		admin: "destructive",
	};
	return variants[role] || "secondary";
};

export const getUserStatusVariant = (isActive: boolean, isLocked: boolean) => {
	if (isLocked) return "destructive";
	if (isActive) return "success";
	return "secondary";
};

export const userValidationPatterns = {
	email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
	username: /^[a-zA-Z0-9_]+$/,
};

export const userValidationMessages = {
	email: {
		required: "Email is required",
		invalid: "Please enter a valid email address",
	},
	password: {
		required: "Password is required",
		minLength: "Password must be at least 8 characters long",
	},
	username: {
		invalid: "Username can only contain letters, numbers, and underscores",
	},
	role: {
		required: "Role is required",
	},
};

export const userFieldDescriptions = {
	email: "This will be used for login and notifications",
	username: "Optional. Can contain letters, numbers, and underscores",
	password: "Must be at least 8 characters long",
	role: "Determines user permissions and access level",
	isActive: "Controls whether the user can log in",
};

export const defaultUserFormData = {
	email: "",
	password: "",
	username: "",
	role: "user" as const,
	is_active: true,
};
