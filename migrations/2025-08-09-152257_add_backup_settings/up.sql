-- Add missing backup configuration settings to system_settings table
INSERT INTO system_settings (category, setting_key, setting_value, data_type, description, default_value, is_sensitive, requires_restart) VALUES
-- Additional backup settings
('database', 'backup_schedule', '0 0 2 * * *', 'string', 'Cron expression for backup schedule (default: daily at 2 AM)', '0 0 2 * * *', FALSE, FALSE),
('database', 'backup_compression', 'true', 'boolean', 'Enable Gzip compression for backups', 'true', FALSE, FALSE),
('database', 'backup_prefix', 'lunarbase-backup', 'string', 'Prefix for backup files in S3 bucket', 'lunarbase-backup', FALSE, FALSE),
('database', 'backup_min_size_bytes', '1024', 'integer', 'Minimum backup size in bytes to consider valid before cleanup', '1024', FALSE, FALSE);