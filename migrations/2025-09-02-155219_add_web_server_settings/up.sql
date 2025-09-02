INSERT INTO system_settings (category, setting_key, setting_value, data_type, description, default_value, is_sensitive, requires_restart) VALUES
('web_server', 'compression_enabled', 'true', 'boolean', 'Enable HTTP compression', 'true', FALSE, FALSE),
('web_server', 'compression_level', '6', 'integer', 'Compression level 1-9', '6', FALSE, FALSE),
('web_server', 'compression_min_size', '1024', 'integer', 'Minimum size in bytes for compression', '1024', FALSE, FALSE),
('web_server', 'compression_gzip', 'true', 'boolean', 'Enable gzip compression', 'true', FALSE, FALSE),
('web_server', 'compression_brotli', 'true', 'boolean', 'Enable brotli compression', 'true', FALSE, FALSE),
('web_server', 'compression_deflate', 'true', 'boolean', 'Enable deflate compression', 'true', FALSE, FALSE);
