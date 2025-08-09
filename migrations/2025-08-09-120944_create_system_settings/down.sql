-- This file should undo anything in `up.sql`
-- Drop trigger first
DROP TRIGGER IF EXISTS update_system_settings_updated_at;

-- Drop indexes
DROP INDEX IF EXISTS idx_system_settings_category_key;
DROP INDEX IF EXISTS idx_system_settings_key;
DROP INDEX IF EXISTS idx_system_settings_category;

-- Drop table
DROP TABLE IF EXISTS system_settings;