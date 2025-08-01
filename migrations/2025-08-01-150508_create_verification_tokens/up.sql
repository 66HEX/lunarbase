-- Verification tokens table for email verification
CREATE TABLE verification_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX idx_verification_tokens_user_id ON verification_tokens(user_id);
CREATE INDEX idx_verification_tokens_expires_at ON verification_tokens(expires_at);
CREATE INDEX idx_verification_tokens_email ON verification_tokens(email);

-- Cleanup trigger to remove expired verification tokens
CREATE TRIGGER cleanup_expired_verification_tokens
    AFTER INSERT ON verification_tokens
    FOR EACH ROW
    BEGIN
        DELETE FROM verification_tokens 
        WHERE expires_at < datetime('now');
    END;