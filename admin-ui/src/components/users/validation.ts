import { z } from 'zod';
import type { CreateUserRequest, UpdateUserRequest } from '@/types/api';

const createUserSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .max(255, 'Email must be less than 255 characters'),
  password: z
    .string()
    .min(1, 'Password is required')
    .refine(
      (val) => val.length >= 8,
      'Password must be at least 8 characters long'
    )
    .refine(
      (val) => /[A-Z]/.test(val),
      'Password must contain at least one uppercase letter'
    )
    .refine(
      (val) => /[a-z]/.test(val),
      'Password must contain at least one lowercase letter'
    )
    .refine(
      (val) => /[0-9]/.test(val),
      'Password must contain at least one number'
    )
    .refine(
      (val) => /[^A-Za-z0-9]/.test(val),
      'Password must contain at least one special character'
    ),
  username: z
    .string()
    .optional()
    .refine(
      (val) => !val || (val.length >= 3 && val.length <= 30),
      'Username must be between 3-30 characters long'
    )
    .refine(
      (val) => !val || /^[a-zA-Z0-9_]+$/.test(val),
      'Username can only contain letters, numbers, and underscores'
    ),
  role: z.enum(['user', 'admin'], {
    message: 'Role must be either user or admin',
  }),
});

const updateUserSchema = z.object({
  email: z
    .string()
    .optional()
    .refine(
      (val) => !val || (val.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)),
      'Please enter a valid email address'
    )
    .refine(
      (val) => !val || val.length <= 255,
      'Email must be less than 255 characters'
    ),
  password: z
    .string()
    .optional()
    .refine(
      (val) => !val || val.length >= 8,
      'Password must be at least 8 characters long'
    )
    .refine(
      (val) => !val || /[A-Z]/.test(val),
      'Password must contain at least one uppercase letter'
    )
    .refine(
      (val) => !val || /[a-z]/.test(val),
      'Password must contain at least one lowercase letter'
    )
    .refine(
      (val) => !val || /[0-9]/.test(val),
      'Password must contain at least one number'
    )
    .refine(
      (val) => !val || /[^A-Za-z0-9]/.test(val),
      'Password must contain at least one special character'
    ),
  username: z
    .string()
    .optional()
    .refine(
      (val) => !val || (val.length >= 3 && val.length <= 30),
      'Username must be between 3-30 characters long'
    )
    .refine(
      (val) => !val || /^[a-zA-Z0-9_]+$/.test(val),
      'Username can only contain letters, numbers, and underscores'
    ),
  role: z.enum(['user', 'admin'], {
    message: 'Role must be either user or admin',
  }).optional(),
  is_active: z.boolean().optional(),
  is_verified: z.boolean().optional(),
});

export function validateCreateUserData(data: CreateUserRequest) {
  try {
    createUserSchema.parse(data);
    return { success: true as const };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      
      for (const issue of error.issues) {
        const fieldName = issue.path[0] as string;
        if (fieldName) {
          // For password field, collect all error messages
          if (fieldName === 'password') {
            if (!fieldErrors[fieldName]) {
              fieldErrors[fieldName] = issue.message;
            } else {
              fieldErrors[fieldName] += '; ' + issue.message;
            }
          } else {
            // For other fields, use only the first error
            if (!fieldErrors[fieldName]) {
              fieldErrors[fieldName] = issue.message;
            }
          }
        }
      }
      
      return {
        success: false as const,
        fieldErrors,
        errors: error.issues.map(issue => issue.message),
      };
    }
    
    return {
      success: false as const,
      fieldErrors: {},
      errors: ['Validation failed'],
    };
  }
}

export function validateUpdateUserData(data: UpdateUserRequest) {
  try {
    updateUserSchema.parse(data);
    return { success: true as const };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      
      for (const issue of error.issues) {
        const fieldName = issue.path[0] as string;
        if (fieldName) {
          // For password field, collect all error messages
          if (fieldName === 'password') {
            if (!fieldErrors[fieldName]) {
              fieldErrors[fieldName] = issue.message;
            } else {
              fieldErrors[fieldName] += '; ' + issue.message;
            }
          } else {
            // For other fields, use only the first error
            if (!fieldErrors[fieldName]) {
              fieldErrors[fieldName] = issue.message;
            }
          }
        }
      }
      
      return {
        success: false as const,
        fieldErrors,
        errors: error.issues.map(issue => issue.message),
      };
    }
    
    return {
      success: false as const,
      fieldErrors: {},
      errors: ['Validation failed'],
    };
  }
}