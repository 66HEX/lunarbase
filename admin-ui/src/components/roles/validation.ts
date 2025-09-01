import { z } from "zod";
import type { CreateRoleRequest, UpdateRoleRequest } from "@/types/api";

const createRoleSchema = z.object({
	name: z
		.string()
		.min(1, "Role name is required")
		.max(50, "Role name must be less than 50 characters")
		.refine(
			(val) => /^[a-zA-Z0-9_]+$/.test(val),
			"Role name can only contain letters, numbers, and underscores",
		),
	description: z
		.string()
		.max(255, "Role description must be less than 255 characters")
		.optional(),
	priority: z
		.number()
		.min(0, "Role priority must be at least 0")
		.max(100, "Role priority must be at most 100"),
});

const updateRoleSchema = z.object({
	name: z
		.string()
		.min(1, "Role name is required")
		.max(50, "Role name must be less than 50 characters")
		.refine(
			(val) => /^[a-zA-Z0-9_]+$/.test(val),
			"Role name can only contain letters, numbers, and underscores",
		)
		.optional(),
	description: z
		.string()
		.max(255, "Role description must be less than 255 characters")
		.optional(),
	priority: z
		.number()
		.min(0, "Role priority must be at least 0")
		.max(100, "Role priority must be at most 100")
		.optional(),
});

export const validateCreateRoleData = (
	data: CreateRoleRequest,
): { success: boolean; fieldErrors: { [key: string]: string } } => {
	try {
		createRoleSchema.parse(data);
		return { success: true, fieldErrors: {} };
	} catch (error) {
		if (error instanceof z.ZodError) {
			const fieldErrors: { [key: string]: string } = {};
			error.issues.forEach((err: z.ZodIssue) => {
				if (err.path && err.path.length > 0) {
					fieldErrors[err.path[0] as string] = err.message;
				}
			});
			return { success: false, fieldErrors };
		}
		return { success: false, fieldErrors: { general: "Validation failed" } };
	}
};

export const validateUpdateRoleData = (
	data: UpdateRoleRequest,
): { success: boolean; fieldErrors: { [key: string]: string } } => {
	try {
		updateRoleSchema.parse(data);
		return { success: true, fieldErrors: {} };
	} catch (error) {
		if (error instanceof z.ZodError) {
			const fieldErrors: { [key: string]: string } = {};
			error.issues.forEach((err: z.ZodIssue) => {
				if (err.path && err.path.length > 0) {
					fieldErrors[err.path[0] as string] = err.message;
				}
			});
			return { success: false, fieldErrors };
		}
		return { success: false, fieldErrors: { general: "Validation failed" } };
	}
};