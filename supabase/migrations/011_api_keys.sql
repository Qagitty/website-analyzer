CREATE TABLE api_keys (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT 'My API Key',
  key_hash     TEXT NOT NULL UNIQUE,    -- SHA-256 hash of the actual key
  key_prefix   TEXT NOT NULL,           -- First 8 chars shown in UI e.g. "wa_live_ab12cd34"
  last_used_at TIMESTAMPTZ,
  requests_today INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_user_id  ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash     ON api_keys(key_hash);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_owner_all" ON api_keys
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "api_keys_service_role" ON api_keys
  FOR ALL USING (auth.role() = 'service_role');
