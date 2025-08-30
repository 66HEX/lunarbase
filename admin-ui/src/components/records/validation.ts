import { z } from "zod";
import type { FieldDefinition } from "@/types/api";

const createFieldValidationSchema = (field: FieldDefinition) => {
	let schema: z.ZodTypeAny;

	switch (field.field_type) {
		case "text":
			schema = z.string();
			
			if (field.validation) {
				if (field.validation.min_length !== undefined) {
					schema = (schema as z.ZodString).min(field.validation.min_length, 
						`Field '${field.name}' is too short (minimum ${field.validation.min_length} characters)`);
				}
				if (field.validation.max_length !== undefined) {
					schema = (schema as z.ZodString).max(field.validation.max_length, 
						`Field '${field.name}' is too long (maximum ${field.validation.max_length} characters)`);
				}
				if (field.validation.pattern) {
					try {
						const regex = new RegExp(field.validation.pattern);
						schema = (schema as z.ZodString).regex(regex, 
							`Field '${field.name}' does not match required pattern: ${field.validation.pattern}`);
					} catch {
						schema = schema.refine(() => false, 
							`Invalid regex pattern for field '${field.name}': ${field.validation.pattern}`);
					}
				}
				if (field.validation.enum_values && field.validation.enum_values.length > 0) {
					schema = schema.refine(
						(val) => field.validation!.enum_values!.includes(val as string),
						`Field '${field.name}' must be one of: ${field.validation.enum_values.join(", ")}`
					);
				}
			}
			break;

		case "number":
			schema = z.number({
				message: `Field '${field.name}' must be a number`,
			});
			
			if (field.validation) {
				if (field.validation.min_value !== undefined) {
					schema = (schema as z.ZodNumber).min(field.validation.min_value, 
						`Field '${field.name}' must be at least ${field.validation.min_value}`);
				}
				if (field.validation.max_value !== undefined) {
					schema = (schema as z.ZodNumber).max(field.validation.max_value, 
						`Field '${field.name}' must be at most ${field.validation.max_value}`);
				}
				if (field.validation.enum_values && field.validation.enum_values.length > 0) {
					const numericEnumValues = field.validation.enum_values.map(Number).filter(n => !isNaN(n));
					if (numericEnumValues.length > 0) {
						schema = schema.refine(
							(val) => numericEnumValues.includes(val as number),
							`Field '${field.name}' must be one of: ${numericEnumValues.join(", ")}`
						);
					}
				}
			}
			break;

		case "boolean":
			schema = z.boolean({
				message: `Field '${field.name}' must be a boolean`
			});
			break;

		case "date":
			schema = z.string().refine(
				(val) => {
					if (!val) return true;
					const date = new Date(val);
					return !isNaN(date.getTime());
				},
				`Field '${field.name}' must be a valid date`
			);
			break;

		case "email":
			schema = z.string().email(`Field '${field.name}' must be a valid email address`);
			break;

		case "url":
			schema = z.string().url(`Field '${field.name}' must be a valid URL`);
			break;

		case "json":
		case "richtext":
			schema = z.union([
				z.string().refine(
					(val) => {
						if (!val) return true;
						try {
							JSON.parse(val);
							return true;
						} catch {
							return false;
						}
					},
					`Field '${field.name}' must be valid JSON`
				),
				z.object({}),
				z.array(z.unknown()),
			], {
				message: `Field '${field.name}' must be valid JSON`,
			});
			break;

		case "file":
			schema = z.string().refine(
				(val) => val.length > 0 && val.length <= 500,
				`Field '${field.name}' must be a valid file path (max 500 characters)`
			);
			break;

		case "relation":
			schema = z.union([
				z.string().min(1).max(50),
				z.number().int()
			], {
				message: `Field '${field.name}' must be a relation ID (string or number)`
			}).refine(
				(val) => {
					if (typeof val === 'string') {
						return val.length > 0 && val.length <= 50;
					}
					return true;
				},
				`Field '${field.name}' must be a valid relation ID (max 50 characters)`
			);
			break;

		default:
			schema = z.unknown();
			break;
	}

	if (!field.required) {
		schema = schema.optional();
		
		if (field.default_value !== undefined) {
			schema = schema.default(field.default_value);
		}
	} else {
		const originalSchema = schema;
		schema = z.preprocess(
			(val) => {
				if (val === null || val === undefined || val === '') {
					throw new z.ZodError([
						{
							code: 'custom',
							message: `Field '${field.name}' is required`,
							path: [field.name]
						}
					]);
				}
				return val;
			},
			originalSchema
		);
	}

	return schema;
};

export const createRecordValidationSchema = (fields: FieldDefinition[]) => {
	const schemaObject: Record<string, z.ZodTypeAny> = {};

	fields.forEach((field) => {
		if (field.name === 'id') {
			return;
		}

		schemaObject[field.name] = createFieldValidationSchema(field);
	});

	return z.object(schemaObject).strict();
};

export const validateRecordData = (
	fields: FieldDefinition[],
	data: Record<string, unknown>
): { success: true; data: Record<string, unknown> } | { success: false; errors: string[] } => {
	try {
		const schema = createRecordValidationSchema(fields);
		const validatedData = schema.parse(data);
		return { success: true, data: validatedData };
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errors = error.issues.map(issue => issue.message);
			return { success: false, errors };
		}
		return { success: false, errors: ['Unknown validation error'] };
	}
};

export type RecordValidationResult = ReturnType<typeof validateRecordData>;