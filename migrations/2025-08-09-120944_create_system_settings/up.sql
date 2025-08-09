-- Create system_settings table
CREATE TABLE system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    category VARCHAR(50) NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT NOT NULL,
    data_type VARCHAR(20) NOT NULL DEFAULT 'string',
    description TEXT,
    default_value TEXT,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    requires_restart BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(100),
    UNIQUE(category, setting_key)
);

-- Create indexes for better performance
CREATE INDEX idx_system_settings_category ON system_settings(category);
CREATE INDEX idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX idx_system_settings_category_key ON system_settings(category, setting_key);

-- Insert default configuration values
INSERT INTO system_settings (category, setting_key, setting_value, data_type, description, default_value, is_sensitive, requires_restart) VALUES
-- Database settings
('database', 'connection_pool_size', '10', 'integer', 'Maximum number of database connections in pool', '10', FALSE, TRUE),
('database', 'backup_enabled', 'false', 'boolean', 'Enable automatic database backups', 'false', FALSE, FALSE),
('database', 'backup_retention_days', '30', 'integer', 'Backup retention period in days', '30', FALSE, FALSE),

-- Auth settings
('auth', 'jwt_lifetime_hours', '24', 'integer', 'JWT token lifetime in hours', '24', FALSE, FALSE),
('auth', 'lockout_duration_minutes', '15', 'integer', 'Account lockout duration in minutes', '15', FALSE, FALSE),
('auth', 'max_login_attempts', '5', 'integer', 'Maximum login attempts before lockout', '5', FALSE, FALSE),

-- API settings
('api', 'rate_limit_requests_per_minute', '100', 'integer', 'Rate limit requests per minute per IP', '100', FALSE, FALSE),
('api', 'cors_allowed_origins', '["http://localhost:3000", "http://localhost:5173", "https://lh3.googleusercontent.com", "https://avatars.githubusercontent.com"]', 'json', 'CORS allowed origins', '["http://localhost:3000", "http://localhost:5173"]', FALSE, TRUE);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_system_settings_updated_at 
    AFTER UPDATE ON system_settings
    FOR EACH ROW
    BEGIN
        UPDATE system_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;