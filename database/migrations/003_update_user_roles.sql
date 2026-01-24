-- Migration: Update user roles to reader/writer/admin
-- Description: Updates the role column to use new role values with proper constraints
-- Date: 2025-12-23

-- Update existing 'user' roles to 'reader'
UPDATE users SET role = 'reader' WHERE role = 'user';

-- Add check constraint for valid roles (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_user_role'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT check_user_role CHECK (role IN ('reader', 'writer', 'admin'));
    END IF;
END $$;

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
