-- Drop triggers
DROP TRIGGER IF EXISTS update_record_permissions_updated_at;
DROP TRIGGER IF EXISTS update_user_collection_permissions_updated_at;
DROP TRIGGER IF EXISTS update_collection_permissions_updated_at;
DROP TRIGGER IF EXISTS update_roles_updated_at;

-- Drop indexes
DROP INDEX IF EXISTS idx_roles_priority;
DROP INDEX IF EXISTS idx_record_permissions_record_collection_user;
DROP INDEX IF EXISTS idx_user_collection_permissions_user_collection;
DROP INDEX IF EXISTS idx_collection_permissions_collection_role;

-- Drop tables in reverse order (foreign key dependencies)
DROP TABLE IF EXISTS record_permissions;
DROP TABLE IF EXISTS user_collection_permissions;
DROP TABLE IF EXISTS collection_permissions;
DROP TABLE IF EXISTS roles;
