-- Migration: Add refresh_token column to users table
-- Description: Adds refresh token column to support token refresh functionality
-- Date: 2025-12-10

-- Add refresh_token column with unique constraint (idempotent)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS refresh_token VARCHAR(500) UNIQUE,
ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMP;

-- Create index for faster lookups (idempotent)
CREATE INDEX IF NOT EXISTS idx_users_refresh_token ON users(refresh_token) WHERE refresh_token IS NOT NULL;
