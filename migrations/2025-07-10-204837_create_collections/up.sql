-- Collections table - stores collection metadata and schema definitions
CREATE TABLE collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT,
    description TEXT,
    schema_json TEXT NOT NULL, -- JSON schema defining fields and validation rules
    is_system BOOLEAN NOT NULL DEFAULT FALSE, -- System collections like users
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Collection records table - stores actual data for collections
CREATE TABLE collection_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    collection_id INTEGER NOT NULL,
    data_json TEXT NOT NULL, -- JSON data conforming to collection schema
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_collections_name ON collections (name);
CREATE INDEX idx_collection_records_collection_id ON collection_records (collection_id);
CREATE INDEX idx_collection_records_created_at ON collection_records (created_at);

-- Triggers to update updated_at timestamps
CREATE TRIGGER update_collections_updated_at 
    AFTER UPDATE ON collections
    BEGIN
        UPDATE collections SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_collection_records_updated_at 
    AFTER UPDATE ON collection_records
    BEGIN
        UPDATE collection_records SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
