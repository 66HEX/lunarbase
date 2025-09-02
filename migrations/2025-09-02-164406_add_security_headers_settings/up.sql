-- Add security headers configuration settings
INSERT INTO system_settings (category, setting_key, setting_value, data_type, description, default_value, is_sensitive, requires_restart) VALUES
-- Security Headers General
('security_headers', 'enabled', 'true', 'boolean', 'Enable security headers', 'true', FALSE, FALSE),

-- HSTS Configuration
('security_headers', 'hsts_enabled', 'true', 'boolean', 'Enable HTTP Strict Transport Security', 'true', FALSE, FALSE),
('security_headers', 'hsts_max_age', '31536000', 'integer', 'HSTS max age in seconds (1 year)', '31536000', FALSE, FALSE),
('security_headers', 'hsts_include_subdomains', 'true', 'boolean', 'Include subdomains in HSTS', 'true', FALSE, FALSE),
('security_headers', 'hsts_preload', 'false', 'boolean', 'Enable HSTS preload', 'false', FALSE, FALSE),

-- Content Security Policy
('security_headers', 'csp_enabled', 'true', 'boolean', 'Enable Content Security Policy', 'true', FALSE, FALSE),
('security_headers', 'csp_policy', 'default-src ''self''; script-src ''self'' ''unsafe-inline''; style-src ''self'' ''unsafe-inline''; img-src ''self'' data:; connect-src ''self''', 'string', 'Content Security Policy', 'default-src ''self''', FALSE, FALSE),
('security_headers', 'csp_report_only', 'false', 'boolean', 'CSP report-only mode', 'false', FALSE, FALSE),

-- X-Frame-Options
('security_headers', 'frame_options_enabled', 'true', 'boolean', 'Enable X-Frame-Options', 'true', FALSE, FALSE),
('security_headers', 'frame_options_policy', 'DENY', 'string', 'X-Frame-Options policy (DENY, SAMEORIGIN, ALLOW-FROM)', 'DENY', FALSE, FALSE),

-- Other Security Headers
('security_headers', 'content_type_options', 'true', 'boolean', 'Enable X-Content-Type-Options: nosniff', 'true', FALSE, FALSE),
('security_headers', 'xss_protection', 'true', 'boolean', 'Enable X-XSS-Protection', 'true', FALSE, FALSE),

-- Referrer Policy
('security_headers', 'referrer_policy_enabled', 'true', 'boolean', 'Enable Referrer-Policy', 'true', FALSE, FALSE),
('security_headers', 'referrer_policy', 'strict-origin-when-cross-origin', 'string', 'Referrer policy', 'strict-origin-when-cross-origin', FALSE, FALSE),

-- Permissions Policy
('security_headers', 'permissions_policy_enabled', 'true', 'boolean', 'Enable Permissions-Policy', 'true', FALSE, FALSE),
('security_headers', 'permissions_policy', 'camera=(), microphone=(), geolocation=(), payment=()', 'string', 'Permissions policy', 'camera=(), microphone=(), geolocation=(), payment=()', FALSE, FALSE);
