import { z } from "zod";

const RESERVED_COLLECTION_NAMES = [
	"users",
	"admin",
	"system",
	"config",
	"settings",
	"auth",
	"permissions",
	"roles",
	"sessions",
	"tokens",
	"logs",
	"metrics",
	"health",
	"backup",
	"restore",
	"migration",
	"schema",
	"metadata",
	"cache",
	"queue",
];

const RESERVED_FIELD_NAMES = [
	"created_at",
	"updated_at",
	"deleted_at",
	"version",
	"metadata",
	"owner_id",
	"created_by",
	"updated_by",
];

const fieldDefinitionSchema = z.object({
	name: z
		.string()
		.min(1, "Field name is required")
		.max(50, "Field name must be 50 characters or less")
		.regex(
			/^[a-zA-Z][a-zA-Z0-9_]*$/,
			"Field name must start with a letter and contain only letters, numbers, and underscores"
		)
		.refine(
			(name) => !RESERVED_FIELD_NAMES.includes(name.toLowerCase()),
			"Field name is reserved and cannot be used"
		),
	field_type: z.enum(["text", "number", "boolean", "date", "email", "url", "json", "file", "relation", "richtext"]),
	required: z.boolean(),
	default_value: z.unknown().optional(),
});

export const createCollectionSchema = z.object({
	name: z
		.string()
		.min(1, "Collection name is required")
		.max(50, "Collection name must be 50 characters or less")
		.regex(
			/^[a-zA-Z][a-zA-Z0-9_]*$/,
			"Collection name must start with a letter and contain only letters, numbers, and underscores"
		)
		.refine(
			(name) => !RESERVED_COLLECTION_NAMES.includes(name.toLowerCase()),
			"Collection name is reserved and cannot be used"
		),
	description: z.string().optional(),
	schema: z.object({
		fields: z
			.array(fieldDefinitionSchema)
			.min(1, "At least one field is required")
			.refine(
				(fields) => {
					const names = fields.map((f) => f.name.toLowerCase());
					return names.length === new Set(names).size;
				},
				"Field names must be unique"
			),
	}),
});

export const editCollectionSchema = createCollectionSchema;

export type CreateCollectionFormData = z.infer<typeof createCollectionSchema>;
export type EditCollectionFormData = z.infer<typeof editCollectionSchema>;
export type FieldDefinitionFormData = z.infer<typeof fieldDefinitionSchema>;