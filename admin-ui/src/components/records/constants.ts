import {
	Braces,
	Calendar,
	Database,
	FileText,
	Hash,
	Link as LinkIcon,
	Mail,
	ToggleLeft,
	Type,
} from "lucide-react";

// Field type icons (same as in collections for consistency)
export const fieldTypeIcons = {
	text: Type,
	number: Hash,
	boolean: ToggleLeft,
	date: Calendar,
	email: Mail,
	url: LinkIcon,
	json: Braces,
	file: FileText,
	relation: Database,
};

// Field type validation patterns
export const fieldValidationPatterns = {
	email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
	url: /^https?:\/\/.+/,
};

// Field validation messages
export const fieldValidationMessages = {
	email: "Please enter a valid email address",
	url: "Please enter a valid URL (starting with http:// or https://)",
	number: "Please enter a valid number",
	json: "Please enter valid JSON",
	required: (fieldName: string) => `${fieldName} is required`,
};

// Default values for different field types
export const getDefaultFieldValue = (fieldType: string, defaultValue?: any) => {
	if (defaultValue !== null && defaultValue !== undefined) {
		return defaultValue;
	}

	switch (fieldType) {
		case "boolean":
			return false;
		case "number":
			return "";
		default:
			return "";
	}
};

// Field type processing for form submission
export const processFieldValue = (
	fieldType: string,
	value: any,
	isRequired: boolean,
) => {
	switch (fieldType) {
		case "number":
			if (value !== "" && value !== null && value !== undefined) {
				return Number(value);
			} else if (!isRequired) {
				return null;
			}
			break;
		case "boolean":
			return Boolean(value);
		case "json":
			if (value && typeof value === "string") {
				try {
					return JSON.parse(value);
				} catch {
					return value;
				}
			}
			return value;
		default:
			return value;
	}
	return value;
};

// Field validation function
export const validateFieldValue = (field: any, value: any): string | null => {
	if (
		field.required &&
		(value === "" || value === null || value === undefined)
	) {
		return fieldValidationMessages.required(field.name);
	}

	if (
		!field.required &&
		(value === "" || value === null || value === undefined)
	) {
		return null;
	}

	switch (field.field_type) {
		case "email":
			if (value && !fieldValidationPatterns.email.test(value)) {
				return fieldValidationMessages.email;
			}
			break;
		case "url":
			if (value && !fieldValidationPatterns.url.test(value)) {
				return fieldValidationMessages.url;
			}
			break;
		case "number":
			if (value && isNaN(Number(value))) {
				return fieldValidationMessages.number;
			}
			break;
		case "json":
			if (value) {
				try {
					JSON.parse(value);
				} catch {
					return fieldValidationMessages.json;
				}
			}
			break;
	}

	return null;
};

// Toast messages for record operations
export const recordToastMessages = {
	validationError: {
		title: "Validation Error",
		description: "Please fix the validation errors below",
		variant: "destructive" as const,
		position: "bottom-center" as const,
		duration: 3000,
	},
};
