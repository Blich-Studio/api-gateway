-- Rollback: Remove token_prefix column and associated indexes

DROP INDEX IF EXISTS idx_verification_tokens_lookup;
DROP INDEX IF EXISTS idx_verification_tokens_prefix;

ALTER TABLE verification_tokens
DROP COLUMN IF EXISTS token_prefix;

-- Recreate original lookup index
CREATE INDEX idx_verification_tokens_lookup ON verification_tokens(user_id, expires_at);
