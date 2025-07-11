-- Create roles table for hierarchical role system
CREATE TABLE roles (
    id INTEGER PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    priority INTEGER NOT NULL DEFAULT 0, -- Higher priority = more permissions
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create collection permissions table for default collection-level permissions
CREATE TABLE collection_permissions (
    id INTEGER PRIMARY KEY NOT NULL,
    collection_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    can_create BOOLEAN NOT NULL DEFAULT FALSE,
    can_read BOOLEAN NOT NULL DEFAULT FALSE,
    can_update BOOLEAN NOT NULL DEFAULT FALSE,
    can_delete BOOLEAN NOT NULL DEFAULT FALSE,
    can_list BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
    UNIQUE(collection_id, role_id)
);

-- Create user-specific collection permissions (overrides role permissions)
CREATE TABLE user_collection_permissions (
    id INTEGER PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    can_create BOOLEAN,
    can_read BOOLEAN,
    can_update BOOLEAN,
    can_delete BOOLEAN,
    can_list BOOLEAN,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE,
    UNIQUE(user_id, collection_id)
);

-- Create record-level permissions for fine-grained access control
CREATE TABLE record_permissions (
    id INTEGER PRIMARY KEY NOT NULL,
    record_id INTEGER NOT NULL,
    collection_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    can_read BOOLEAN NOT NULL DEFAULT FALSE,
    can_update BOOLEAN NOT NULL DEFAULT FALSE,
    can_delete BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE,
    UNIQUE(record_id, collection_id, user_id)
);

-- Insert default roles
INSERT INTO roles (name, description, priority) VALUES 
    ('admin', 'Full system administrator with all permissions', 1000),
    ('user', 'Regular user with limited permissions', 100),
    ('guest', 'Guest user with read-only access', 10);

-- Create indexes for performance
CREATE INDEX idx_collection_permissions_collection_role ON collection_permissions(collection_id, role_id);
CREATE INDEX idx_user_collection_permissions_user_collection ON user_collection_permissions(user_id, collection_id);
CREATE INDEX idx_record_permissions_record_collection_user ON record_permissions(record_id, collection_id, user_id);
CREATE INDEX idx_roles_priority ON roles(priority DESC);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_roles_updated_at 
    AFTER UPDATE ON roles
    BEGIN
        UPDATE roles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_collection_permissions_updated_at 
    AFTER UPDATE ON collection_permissions
    BEGIN
        UPDATE collection_permissions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_user_collection_permissions_updated_at 
    AFTER UPDATE ON user_collection_permissions
    BEGIN
        UPDATE user_collection_permissions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_record_permissions_updated_at 
    AFTER UPDATE ON record_permissions
    BEGIN
        UPDATE record_permissions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
