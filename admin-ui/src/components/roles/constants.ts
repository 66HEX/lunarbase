import type { CreateRoleRequest } from "@/types/api";

export const roleValidationMessages = {
	name: {
		required: "Role name is required",
		invalid: "Role name can only contain letters, numbers, and underscores",
		maxLength: "Role name must be less than 50 characters",
	},
	description: {
		maxLength: "Role description must be less than 255 characters",
	},
	priority: {
		range: "Role priority must be between 0 and 100",
	},
};

export const roleFieldDescriptions = {
	name: "Unique identifier for the role. Can contain letters, numbers, and underscores",
	description: "Optional description of what this role is for",
	priority: "Priority level (0-100). Higher numbers indicate higher priority",
};

export const defaultRoleFormData: CreateRoleRequest = {
	name: "",
	description: "",
	priority: 50,
};

export const rolePriorityOptions = [
	{ value: 10, label: "Low (10)" },
	{ value: 25, label: "Below Normal (25)" },
	{ value: 50, label: "Normal (50)" },
	{ value: 75, label: "Above Normal (75)" },
	{ value: 90, label: "High (90)" },
	{ value: 100, label: "Critical (100)" },
];