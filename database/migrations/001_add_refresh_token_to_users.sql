-- Migration: Add refresh_token column to users table
-- Description: Adds refresh token column to support token refresh functionality
-- Date: 2025-12-10

-- Add refresh_token column with unique constraint
ALTER TABLE users
ADD COLUMN refresh_token VARCHAR(500) UNIQUE,
ADD COLUMN refresh_token_expires_at TIMESTAMP;

-- Create index for faster lookups
CREATE INDEX idx_users_refresh_token ON users(refresh_token) WHERE refresh_token IS NOT NULL;
