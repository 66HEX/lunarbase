-- Remove security headers configuration settings
DELETE FROM system_settings WHERE category = 'security_headers';
