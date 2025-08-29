import {
	BracketsSquareIcon,
	CalendarIcon,
	DatabaseIcon,
	FileTextIcon,
	HashIcon,
	LinkIcon,
	EnvelopeIcon,
	ToggleLeftIcon,
	TextAaIcon,
} from "@phosphor-icons/react";

export const fieldTypeIcons = {
	text: TextAaIcon,
	number: HashIcon,
	boolean: ToggleLeftIcon,
	date: CalendarIcon,
	email: EnvelopeIcon,
	url: LinkIcon,
	json: BracketsSquareIcon,
	file: FileTextIcon,
	relation: DatabaseIcon,
};

export const fieldTypeOptions = [
	{ value: "text", label: "Text" },
	{ value: "number", label: "Number" },
	{ value: "boolean", label: "Boolean" },
	{ value: "date", label: "Date" },
	{ value: "email", label: "Email" },
	{ value: "url", label: "URL" },
	{ value: "json", label: "JSON" },
	{ value: "file", label: "File" },
	{ value: "relation", label: "Relation" },
];

export const getFieldTypeVariant = (type: string) => {
	const variants: {
		[key: string]:
			| "default"
			| "secondary"
			| "destructive"
			| "success"
			| "warning"
			| "outline";
	} = {
		text: "default",
		number: "success",
		boolean: "secondary",
		date: "warning",
		email: "destructive",
		url: "outline",
		json: "warning",
		file: "secondary",
		relation: "outline",
	};
	return variants[type] || "secondary";
};

export const formatDate = (dateString: string) => {
	return new Date(dateString).toLocaleString("en-US");
};
