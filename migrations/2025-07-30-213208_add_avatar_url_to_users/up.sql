-- Add avatar_url column to users table
ALTER TABLE users ADD COLUMN avatar_url TEXT NULL;

-- Create index for avatar_url for potential future queries
CREATE INDEX idx_users_avatar_url ON users(avatar_url);