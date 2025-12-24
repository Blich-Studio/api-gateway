-- Add last_login_at column to users table
-- This tracks when a user last logged in

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create an index for sorting by last login
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at);
