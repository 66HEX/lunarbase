-- Blacklisted tokens table for JWT token invalidation
CREATE TABLE blacklisted_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    jti VARCHAR(255) NOT NULL UNIQUE,  -- JWT ID from token claims
    user_id INTEGER NOT NULL,
    token_type VARCHAR(20) NOT NULL,   -- 'access' or 'refresh'
    expires_at TIMESTAMP NOT NULL,     -- When the token expires
    blacklisted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reason VARCHAR(100),               -- Optional reason for blacklisting
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_blacklisted_tokens_jti ON blacklisted_tokens(jti);
CREATE INDEX idx_blacklisted_tokens_user_id ON blacklisted_tokens(user_id);
CREATE INDEX idx_blacklisted_tokens_expires_at ON blacklisted_tokens(expires_at);
CREATE INDEX idx_blacklisted_tokens_type ON blacklisted_tokens(token_type);

-- Cleanup trigger to remove expired blacklisted tokens
CREATE TRIGGER cleanup_expired_blacklisted_tokens
    AFTER INSERT ON blacklisted_tokens
    FOR EACH ROW
    BEGIN
        DELETE FROM blacklisted_tokens 
        WHERE expires_at < datetime('now');
    END;