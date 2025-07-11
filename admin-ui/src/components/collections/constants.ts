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
