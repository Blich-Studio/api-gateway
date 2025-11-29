-- Add token_prefix column for efficient token lookup
-- This allows us to query only tokens with matching prefix instead of all unexpired tokens

ALTER TABLE verification_tokens
ADD COLUMN token_prefix VARCHAR(8);

-- Delete existing tokens since we can't backfill their prefixes (tokens are hashed)
-- Users will need to request new verification emails
DELETE FROM verification_tokens WHERE token_prefix IS NULL;

-- Make token_prefix required going forward
ALTER TABLE verification_tokens
ALTER COLUMN token_prefix SET NOT NULL;

-- Create index for efficient lookup by token prefix
CREATE INDEX idx_verification_tokens_prefix ON verification_tokens(token_prefix);

-- Update the composite index to include token_prefix
DROP INDEX IF EXISTS idx_verification_tokens_lookup;
CREATE INDEX idx_verification_tokens_lookup ON verification_tokens(token_prefix, expires_at);

-- Add comment explaining the optimization
COMMENT ON COLUMN verification_tokens.token_prefix IS 'First 8 characters of unhashed token for efficient lookup';
