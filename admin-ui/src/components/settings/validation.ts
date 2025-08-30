import { z } from 'zod';

const validateCategory = (category: string) => {
  const validCategories = ['database', 'auth', 'api'];
  return validCategories.includes(category.toLowerCase());
};

const validateDataType = (dataType: string) => {
  const validDataTypes = ['string', 'integer', 'boolean', 'json', 'float'];
  return validDataTypes.includes(dataType.toLowerCase());
};

const validateSettingKey = (key: string) => {
  if (!key || key.length === 0) return false;
  if (key.length > 100) return false;
  return /^[a-zA-Z0-9_-]+$/.test(key);
};

const createSettingValueSchema = (dataType: string) => {
  switch (dataType.toLowerCase()) {
    case 'string':
      return z.string().max(10000, 'Setting value is too long (maximum 10000 characters)');
    
    case 'integer':
      return z.string().refine(
        (val) => {
          const parsed = parseInt(val, 10);
          return !isNaN(parsed) && parsed.toString() === val;
        },
        'Invalid integer value'
      );
    
    case 'float':
      return z.string().refine(
        (val) => {
          const parsed = parseFloat(val);
          return !isNaN(parsed);
        },
        'Invalid float value'
      );
    
    case 'boolean':
      return z.string().refine(
        (val) => {
          const lowerVal = val.toLowerCase();
          return ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(lowerVal);
        },
        'Invalid boolean value. Expected: true, false, 1, 0, yes, no, on, off'
      );
    
    case 'json':
      return z.string().refine(
        (val) => {
          if (!val) return true;
          try {
            JSON.parse(val);
            return true;
          } catch {
            return false;
          }
        },
        'Invalid JSON value'
      );
    
    default:
      return z.string();
  }
};

export const createUpdateSettingSchema = (dataType: string) => {
  return z.object({
    setting_value: createSettingValueSchema(dataType),
    description: z.string().optional(),
  });
};

export const createSettingSchema = z.object({
  category: z.string().refine(
    validateCategory,
    'Invalid category. Must be one of: database, auth, api'
  ),
  setting_key: z.string().refine(
    validateSettingKey,
    'Invalid setting key. Must be non-empty, max 100 characters, and contain only alphanumeric characters, underscores, and hyphens'
  ),
  setting_value: z.string(),
  data_type: z.string().refine(
    validateDataType,
    'Invalid data type. Must be one of: string, integer, boolean, json, float'
  ),
  description: z.string().optional(),
  default_value: z.string().optional(),
  is_sensitive: z.boolean().optional(),
  requires_restart: z.boolean().optional(),
}).refine(
  (data) => {
    const valueSchema = createSettingValueSchema(data.data_type);
    const result = valueSchema.safeParse(data.setting_value);
    return result.success;
  },
  {
    message: 'Setting value does not match the specified data type',
    path: ['setting_value'],
  }
).refine(
  (data) => {
    if (!data.default_value) return true;
    const valueSchema = createSettingValueSchema(data.data_type);
    const result = valueSchema.safeParse(data.default_value);
    return result.success;
  },
  {
    message: 'Default value does not match the specified data type',
    path: ['default_value'],
  }
);

export {
  validateCategory,
  validateDataType,
  validateSettingKey,
  createSettingValueSchema,
};

export type UpdateSettingFormData = z.infer<ReturnType<typeof createUpdateSettingSchema>>;
export type CreateSettingFormData = z.infer<typeof createSettingSchema>;