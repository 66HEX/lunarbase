-- Drop triggers first
DROP TRIGGER IF EXISTS update_collection_records_updated_at;
DROP TRIGGER IF EXISTS update_collections_updated_at;

-- Drop indexes
DROP INDEX IF EXISTS idx_collection_records_created_at;
DROP INDEX IF EXISTS idx_collection_records_collection_id;
DROP INDEX IF EXISTS idx_collections_name;

-- Drop tables (collection_records first due to foreign key)
DROP TABLE IF EXISTS collection_records;
DROP TABLE IF EXISTS collections;
