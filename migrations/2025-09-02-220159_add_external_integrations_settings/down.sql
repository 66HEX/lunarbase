-- Remove email settings
DELETE FROM system_settings WHERE category = 'email';

-- Remove OAuth settings
DELETE FROM system_settings WHERE category = 'oauth';

-- Remove storage settings
DELETE FROM system_settings WHERE category = 'storage';