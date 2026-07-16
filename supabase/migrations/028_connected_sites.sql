-- ============================================================
-- Migration 028: Connected Sites & Site Connection Script
--
-- Adds the data model for the "Connected Sites" feature:
--   connected_sites            — verified site registry
--   connected_site_keys        — ws_site_ public key store
--   site_verification_challenges — short-lived ownership tokens
--   site_connection_status     — upserted on each heartbeat
--   site_telemetry_events      — bounded first-party metrics
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. connected_sites
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connected_sites (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id                    UUID REFERENCES team_members(id) ON DELETE SET NULL,
  monitor_id                 UUID REFERENCES monitors(id) ON DELETE SET NULL,
  name                       TEXT NOT NULL,
  root_url                   TEXT NOT NULL,
  normalized_origin          TEXT NOT NULL,   -- e.g. "https://example.com"
  canonical_host             TEXT NOT NULL,   -- e.g. "example.com"
  verification_status        TEXT NOT NULL DEFAULT 'unverified'
                               CHECK (verification_status IN
                                 ('unverified','pending','verified','failed','expired','revoked')),
  verification_method        TEXT
                               CHECK (verification_method IN
                                 ('script','meta_tag','html_file','dns_txt')),
  verified_at                TIMESTAMPTZ,
  last_verified_at           TIMESTAMPTZ,
  last_heartbeat_at          TIMESTAMPTZ,
  last_script_version        TEXT,
  is_enabled                 BOOLEAN NOT NULL DEFAULT TRUE,
  telemetry_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
  indexing_diagnostics_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  crawler_visibility_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  environment                TEXT NOT NULL DEFAULT 'production'
                               CHECK (environment IN ('production','staging','development')),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A user cannot register the same canonical origin twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_user_origin
  ON connected_sites(user_id, normalized_origin)
  WHERE verification_status != 'revoked';

CREATE INDEX IF NOT EXISTS idx_cs_user_id   ON connected_sites(user_id);
CREATE INDEX IF NOT EXISTS idx_cs_monitor   ON connected_sites(monitor_id)   WHERE monitor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cs_host      ON connected_sites(canonical_host);
CREATE INDEX IF NOT EXISTS idx_cs_status    ON connected_sites(verification_status);

CREATE TRIGGER connected_sites_updated_at
  BEFORE UPDATE ON connected_sites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 2. connected_site_keys
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connected_site_keys (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connected_site_id UUID NOT NULL REFERENCES connected_sites(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_prefix        TEXT NOT NULL,            -- "ws_site_xxx" first ~16 chars for display
  key_hash          TEXT NOT NULL UNIQUE,     -- SHA-256 for lookup; never plaintext
  key_encrypted     TEXT,                     -- AES-256-GCM for reveal (v2: format)
  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','rotated','revoked')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at        TIMESTAMPTZ,
  revoked_at        TIMESTAMPTZ,
  last_used_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_csk_site_id ON connected_site_keys(connected_site_id);
CREATE INDEX IF NOT EXISTS idx_csk_user_id ON connected_site_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_csk_hash    ON connected_site_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_csk_status  ON connected_site_keys(status);

-- ────────────────────────────────────────────────────────────
-- 3. site_verification_challenges
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_verification_challenges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connected_site_id UUID NOT NULL REFERENCES connected_sites(id) ON DELETE CASCADE,
  method            TEXT NOT NULL
                      CHECK (method IN ('script','meta_tag','html_file','dns_txt')),
  token_hash        TEXT NOT NULL UNIQUE,     -- SHA-256; never plaintext in DB
  token_encrypted   TEXT,                     -- AES-256-GCM for UI reveal
  expected_value    TEXT,                     -- e.g. full meta-tag content string
  expires_at        TIMESTAMPTZ NOT NULL,
  consumed_at       TIMESTAMPTZ,
  attempt_count     INTEGER NOT NULL DEFAULT 0,
  last_attempt_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_svc_site_id ON site_verification_challenges(connected_site_id);
CREATE INDEX IF NOT EXISTS idx_svc_expires ON site_verification_challenges(expires_at);
-- Partial index to find the active (unconsumed) challenge for a site
CREATE INDEX IF NOT EXISTS idx_svc_active
  ON site_verification_challenges(connected_site_id, method)
  WHERE consumed_at IS NULL;

-- ────────────────────────────────────────────────────────────
-- 4. site_connection_status  (one row per connected site, upserted on heartbeat)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_connection_status (
  connected_site_id   UUID PRIMARY KEY REFERENCES connected_sites(id) ON DELETE CASCADE,
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sdk_version         TEXT NOT NULL DEFAULT 'unknown',
  page_url            TEXT,     -- sanitized (no query string secrets)
  environment         TEXT NOT NULL DEFAULT 'production',
  script_load_status  TEXT NOT NULL DEFAULT 'unknown'
                        CHECK (script_load_status IN
                          ('loaded','initialized','config_error','origin_rejected',
                           'csp_blocked','unknown')),
  config_version      TEXT,
  latest_safe_metadata JSONB,  -- small bounded JSONB (<4KB) of safe metadata
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER site_connection_status_updated_at
  BEFORE UPDATE ON site_connection_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 5. site_telemetry_events  (bounded; pruned by retention job)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_telemetry_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connected_site_id UUID NOT NULL REFERENCES connected_sites(id) ON DELETE CASCADE,
  event_type        TEXT NOT NULL,
  page_url_sanitized TEXT,
  route             TEXT,
  timestamp         TIMESTAMPTZ NOT NULL,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metrics           JSONB,      -- bounded metric payload (<8KB)
  sdk_version       TEXT NOT NULL DEFAULT 'unknown',
  schema_version    INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ste_site_id   ON site_telemetry_events(connected_site_id);
CREATE INDEX IF NOT EXISTS idx_ste_event_type ON site_telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ste_received   ON site_telemetry_events(received_at DESC);

-- ────────────────────────────────────────────────────────────
-- 6. RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE connected_sites            ENABLE ROW LEVEL SECURITY;
ALTER TABLE connected_site_keys        ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_verification_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_connection_status     ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_telemetry_events      ENABLE ROW LEVEL SECURITY;

-- connected_sites: owner access only
CREATE POLICY "cs_select_own" ON connected_sites
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cs_insert_own" ON connected_sites
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cs_update_own" ON connected_sites
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cs_delete_own" ON connected_sites
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "cs_service_role" ON connected_sites
  FOR ALL USING (auth.role() = 'service_role');

-- connected_site_keys: owner access only
CREATE POLICY "csk_select_own" ON connected_site_keys
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "csk_insert_own" ON connected_site_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "csk_update_own" ON connected_site_keys
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "csk_service_role" ON connected_site_keys
  FOR ALL USING (auth.role() = 'service_role');

-- site_verification_challenges: owner via site
CREATE POLICY "svc_select_own" ON site_verification_challenges
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM connected_sites cs
            WHERE cs.id = connected_site_id AND cs.user_id = auth.uid())
  );
CREATE POLICY "svc_insert_own" ON site_verification_challenges
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM connected_sites cs
            WHERE cs.id = connected_site_id AND cs.user_id = auth.uid())
  );
CREATE POLICY "svc_service_role" ON site_verification_challenges
  FOR ALL USING (auth.role() = 'service_role');

-- site_connection_status: owner via site
CREATE POLICY "scs_select_own" ON site_connection_status
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM connected_sites cs
            WHERE cs.id = connected_site_id AND cs.user_id = auth.uid())
  );
CREATE POLICY "scs_service_role" ON site_connection_status
  FOR ALL USING (auth.role() = 'service_role');

-- site_telemetry_events: owner via site (read), service role for writes
CREATE POLICY "ste_select_own" ON site_telemetry_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM connected_sites cs
            WHERE cs.id = connected_site_id AND cs.user_id = auth.uid())
  );
CREATE POLICY "ste_service_role" ON site_telemetry_events
  FOR ALL USING (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────
-- 7. Lookup function for the public ingestion endpoint
--    Resolves a site key hash to a connected site without
--    exposing the service role to the browser script.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_site_key(p_key_hash TEXT)
RETURNS TABLE (
  connected_site_id UUID,
  user_id           UUID,
  normalized_origin TEXT,
  is_enabled        BOOLEAN,
  telemetry_enabled BOOLEAN,
  indexing_diagnostics_enabled BOOLEAN
) SECURITY DEFINER AS $$
  SELECT
    cs.id,
    cs.user_id,
    cs.normalized_origin,
    cs.is_enabled,
    cs.telemetry_enabled,
    cs.indexing_diagnostics_enabled
  FROM connected_site_keys csk
  JOIN connected_sites cs ON cs.id = csk.connected_site_id
  WHERE csk.key_hash = p_key_hash
    AND csk.status   = 'active'
    AND cs.verification_status = 'verified'
    AND cs.is_enabled = TRUE
  LIMIT 1;
$$ LANGUAGE sql;

COMMENT ON TABLE connected_sites IS
  'Registry of websites associated with a WebScore account for verification and telemetry.';
COMMENT ON TABLE connected_site_keys IS
  'Public ws_site_ keys used by the connection script. Site keys are public; security relies on origin validation + rate limits.';
COMMENT ON TABLE site_verification_challenges IS
  'Short-lived tokens used to prove domain ownership. Tokens are hashed; raw value revealed once to the user.';
COMMENT ON TABLE site_connection_status IS
  'Latest heartbeat state per connected site. One row per site, upserted on script heartbeat.';
COMMENT ON TABLE site_telemetry_events IS
  'Bounded first-party telemetry events. Pruned by retention.cleanup job according to plan.';
