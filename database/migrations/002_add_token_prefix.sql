-- Add token_prefix column for efficient token lookup
-- This allows us to query only tokens with matching prefix instead of all unexpired tokens

ALTER TABLE verification_tokens
ADD COLUMN token_prefix VARCHAR(8);

-- Create index for efficient lookup by token prefix
CREATE INDEX idx_verification_tokens_prefix ON verification_tokens(token_prefix);

-- Update the composite index to include token_prefix
DROP INDEX IF EXISTS idx_verification_tokens_lookup;
CREATE INDEX idx_verification_tokens_lookup ON verification_tokens(token_prefix, expires_at);

-- Add comment explaining the optimization
COMMENT ON COLUMN verification_tokens.token_prefix IS 'First 8 characters of unhashed token for efficient lookup';
