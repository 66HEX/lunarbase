-- Drop the cleanup trigger
DROP TRIGGER IF EXISTS cleanup_expired_verification_tokens;

-- Drop indexes
DROP INDEX IF EXISTS idx_verification_tokens_token;
DROP INDEX IF EXISTS idx_verification_tokens_user_id;
DROP INDEX IF EXISTS idx_verification_tokens_expires_at;
DROP INDEX IF EXISTS idx_verification_tokens_email;

-- Drop the verification_tokens table
DROP TABLE IF EXISTS verification_tokens;