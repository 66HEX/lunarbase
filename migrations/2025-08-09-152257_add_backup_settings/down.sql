-- Remove backup configuration settings from system_settings table
DELETE FROM system_settings WHERE category = 'database' AND setting_key IN (
    'backup_schedule',
    'backup_compression',
    'backup_prefix',
    'backup_min_size_bytes'
);