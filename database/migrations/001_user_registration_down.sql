-- Rollback for User Registration and Verification Database Schema
-- For Cloud SQL PostgreSQL
-- This file should be run to reverse the changes from 001_user_registration.sql

-- Drop trigger first
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_verification_tokens_expires_at;
DROP INDEX IF EXISTS idx_verification_tokens_user_id;
DROP INDEX IF EXISTS idx_verification_tokens_token;
DROP INDEX IF EXISTS idx_users_is_verified;
DROP INDEX IF EXISTS idx_users_email;

-- Drop tables (verification_tokens first due to foreign key)
DROP TABLE IF EXISTS verification_tokens;
DROP TABLE IF EXISTS users;
