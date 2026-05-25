-- Store AES-256-GCM encrypted key for user-facing reveal.
-- The hash is still used for authentication; encryption allows recovery.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_encrypted TEXT;
