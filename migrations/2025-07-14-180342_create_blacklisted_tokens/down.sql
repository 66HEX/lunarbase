-- Drop the cleanup trigger
DROP TRIGGER IF EXISTS cleanup_expired_blacklisted_tokens;

-- Drop indexes
DROP INDEX IF EXISTS idx_blacklisted_tokens_jti;
DROP INDEX IF EXISTS idx_blacklisted_tokens_user_id;
DROP INDEX IF EXISTS idx_blacklisted_tokens_expires_at;
DROP INDEX IF EXISTS idx_blacklisted_tokens_type;

-- Drop the blacklisted_tokens table
DROP TABLE IF EXISTS blacklisted_tokens;