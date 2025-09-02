-- Email settings (Resend)
INSERT INTO system_settings (category, setting_key, setting_value, data_type, description, default_value, is_sensitive, requires_restart) VALUES
('email', 'resend_api_key', '', 'string', 'Resend API key for email service', '', TRUE, FALSE),
('email', 'email_from', 'noreply@example.com', 'string', 'Default sender email address', 'noreply@example.com', FALSE, FALSE),
('email', 'email_enabled', 'false', 'boolean', 'Enable email service', 'false', FALSE, FALSE);

-- OAuth settings
INSERT INTO system_settings (category, setting_key, setting_value, data_type, description, default_value, is_sensitive, requires_restart) VALUES
('oauth', 'google_client_id', '', 'string', 'Google OAuth client ID', '', FALSE, TRUE),
('oauth', 'google_client_secret', '', 'string', 'Google OAuth client secret', '', TRUE, TRUE),
('oauth', 'github_client_id', '', 'string', 'GitHub OAuth client ID', '', FALSE, TRUE),
('oauth', 'github_client_secret', '', 'string', 'GitHub OAuth client secret', '', TRUE, TRUE),
('oauth', 'oauth_enabled', 'false', 'boolean', 'Enable OAuth authentication', 'false', FALSE, TRUE);

-- Storage settings (S3)
INSERT INTO system_settings (category, setting_key, setting_value, data_type, description, default_value, is_sensitive, requires_restart) VALUES
('storage', 's3_bucket_name', '', 'string', 'S3 bucket name for file storage', '', FALSE, FALSE),
('storage', 's3_region', 'us-east-1', 'string', 'S3 region', 'us-east-1', FALSE, FALSE),
('storage', 's3_access_key_id', '', 'string', 'S3 access key ID', '', TRUE, FALSE),
('storage', 's3_secret_access_key', '', 'string', 'S3 secret access key', '', TRUE, FALSE),
('storage', 's3_endpoint_url', '', 'string', 'Custom S3 endpoint URL (optional)', '', FALSE, FALSE),
('storage', 's3_enabled', 'false', 'boolean', 'Enable S3 file storage', 'false', FALSE, FALSE);