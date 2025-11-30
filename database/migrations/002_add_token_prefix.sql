-- ============================================================================
-- DESTRUCTIVE MIGRATION: This migration will DELETE all existing tokens
-- ============================================================================
-- 
-- IMPORTANT: This migration is destructive and will delete all existing 
-- verification tokens. This is necessary because:
--
-- 1. Tokens are hashed with SHA-256 before storage (for security)
-- 2. We cannot extract the prefix from hashed tokens (SHA-256 is one-way hashing)
-- 3. The new token lookup mechanism requires the prefix to be stored
--
-- NOTE: TOKEN_PREFIX_LENGTH constant is defined in user-auth.service.ts as 8
-- The VARCHAR(8) length here must match that constant to prevent inconsistency
--
-- IMPACT ON USERS:
-- - All users with pending email verifications will need to request a new 
--   verification email after this migration
-- - No data loss for verified users - only pending verification tokens affected
--
-- RECOMMENDATION:
-- - Run this migration during low-traffic periods
-- - Consider notifying users about the need to re-verify if they have pending verifications
-- - Monitor verification request volume after migration
-- ============================================================================

-- Add token_prefix column for efficient token lookup
-- This allows us to query only tokens with matching prefix instead of all unexpired tokens

ALTER TABLE verification_tokens
ADD COLUMN token_prefix VARCHAR(8);

-- Check and log existing tokens before deletion
DO $$
DECLARE
  token_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO token_count FROM verification_tokens WHERE token_prefix IS NULL;
  
  IF token_count > 0 THEN
    RAISE NOTICE 'WARNING: Deleting % existing verification token(s)', token_count;
    RAISE NOTICE 'Users will need to request new verification emails';
    
    -- Delete existing tokens since we can't backfill their prefixes (tokens are hashed)
    DELETE FROM verification_tokens WHERE token_prefix IS NULL;
    RAISE NOTICE 'Deleted % token(s)', token_count;
  ELSE
    RAISE NOTICE 'No existing tokens to delete';
  END IF;
END $$;

-- Make token_prefix required going forward
ALTER TABLE verification_tokens
ALTER COLUMN token_prefix SET NOT NULL;

-- RECOMMENDED: Check token count before running this migration
-- Run this query first: SELECT COUNT(*) FROM verification_tokens WHERE token_prefix IS NULL;

-- Create composite index for efficient lookup (no separate single-column index needed)
-- PostgreSQL can use this for token_prefix-only queries (leftmost prefix rule)
DROP INDEX IF EXISTS idx_verification_tokens_lookup;
DROP INDEX IF EXISTS idx_verification_tokens_prefix; -- Remove if exists from previous runs
CREATE INDEX idx_verification_tokens_lookup ON verification_tokens(token_prefix, expires_at);

-- Add comment explaining the optimization
COMMENT ON COLUMN verification_tokens.token_prefix IS 'First 8 characters of the original token (before hashing) for efficient lookup';
