import {
	BracketsCurlyIcon,
	CalendarIcon,
	DatabaseIcon,
	EnvelopeIcon,
	FileTextIcon,
	HashIcon,
	LinkIcon,
	TextAaIcon,
	ToggleLeftIcon,
} from "@phosphor-icons/react";
import type { FileUploadFile } from "@/components/ui/file-upload";

export const fieldTypeIcons = {
	text: TextAaIcon,
	number: HashIcon,
	boolean: ToggleLeftIcon,
	date: CalendarIcon,
	email: EnvelopeIcon,
	url: LinkIcon,
	json: BracketsCurlyIcon,
	file: FileTextIcon,
	relation: DatabaseIcon,
	richtext: BracketsCurlyIcon,
};

export const fieldValidationPatterns = {
	email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
	url: /^https?:\/\/.+/,
};

export const fieldValidationMessages = {
	email: "Please enter a valid email address",
	url: "Please enter a valid URL (starting with http:// or https://)",
	number: "Please enter a valid number",
	json: "Please enter valid JSON",
	required: (fieldName: string) => `${fieldName} is required`,
};

export const getDefaultFieldValue = (
	fieldType: string,
	defaultValue?: unknown,
) => {
	if (defaultValue !== null && defaultValue !== undefined) {
		return defaultValue;
	}

	switch (fieldType) {
		case "boolean":
			return false;
		case "number":
			return "";
		case "file":
			return [];
		case "richtext":
			return { type: "doc", content: [] };
		default:
			return "";
	}
};

export const processFieldValue = (
	fieldType: string,
	value: unknown,
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
		case "richtext":
			if (value && typeof value === "string") {
				try {
					return JSON.parse(value);
				} catch {
					return value;
				}
			}
			return value;
		case "file":
			if (Array.isArray(value)) {
				return value
					.map((fileUpload: FileUploadFile) => fileUpload.file)
					.filter(Boolean);
			}
			return isRequired ? [] : null;
		default:
			return value;
	}
	return value;
};

export const validateFieldValue = (
	field: { name: string; field_type: string; required: boolean },
	value: unknown,
): string | null => {
	if (field.field_type === "file") {
		if (field.required && (!Array.isArray(value) || value.length === 0)) {
			return fieldValidationMessages.required(field.name);
		}
		return null;
	}

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
			if (
				value &&
				typeof value === "string" &&
				!fieldValidationPatterns.email.test(value)
			) {
				return fieldValidationMessages.email;
			}
			break;
		case "url":
			if (
				value &&
				typeof value === "string" &&
				!fieldValidationPatterns.url.test(value)
			) {
				return fieldValidationMessages.url;
			}
			break;
		case "number":
			if (value && isNaN(Number(value))) {
				return fieldValidationMessages.number;
			}
			break;
		case "json":
		case "richtext":
			if (value && typeof value === "string") {
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

export const recordToastMessages = {
	validationError: {
		title: "Validation Error",
		description: "Please fix the validation errors below",
		variant: "destructive" as const,
		position: "bottom-center" as const,
		duration: 3000,
	},
};
