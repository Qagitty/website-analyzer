-- ============================================
-- 032_error_monitoring.sql
-- Runtime Error Monitoring
-- ============================================

-- Error Projects
CREATE TABLE error_projects (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_site_id           UUID REFERENCES connected_sites(id) ON DELETE SET NULL,

  name                        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  normalized_origin           TEXT NOT NULL CHECK (char_length(normalized_origin) <= 512),
  environment                 TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production','staging','development','custom')),
  status                      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','revoked')),

  ingestion_key_prefix        TEXT NOT NULL,
  ingestion_key_hash          TEXT NOT NULL UNIQUE,
  ingestion_key_encrypted     TEXT,

  allowed_origins             TEXT[] NOT NULL DEFAULT '{}',
  sample_rate                 NUMERIC(3,2) NOT NULL DEFAULT 1.00 CHECK (sample_rate >= 0 AND sample_rate <= 1),
  capture_unhandled_errors    BOOLEAN NOT NULL DEFAULT true,
  capture_unhandled_rejections BOOLEAN NOT NULL DEFAULT true,
  capture_resource_errors     BOOLEAN NOT NULL DEFAULT false,
  capture_console_errors      BOOLEAN NOT NULL DEFAULT false,
  max_breadcrumbs             INTEGER NOT NULL DEFAULT 30 CHECK (max_breadcrumbs BETWEEN 0 AND 100),

  event_quota_monthly         INTEGER NOT NULL DEFAULT 5000,
  retention_days              INTEGER NOT NULL DEFAULT 7,
  sdk_config_version          INTEGER NOT NULL DEFAULT 1,

  last_event_at               TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_error_projects_user ON error_projects(user_id);
CREATE INDEX idx_error_projects_key_hash ON error_projects(ingestion_key_hash);
CREATE INDEX idx_error_projects_site ON error_projects(connected_site_id) WHERE connected_site_id IS NOT NULL;

-- Error Issues (grouped problems) — created before error_events to avoid forward reference issues
CREATE TABLE error_issues (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_project_id          UUID NOT NULL REFERENCES error_projects(id) ON DELETE CASCADE,
  user_id                   UUID NOT NULL,

  fingerprint               TEXT NOT NULL CHECK (char_length(fingerprint) <= 256),
  title                     TEXT NOT NULL CHECK (char_length(title) <= 512),
  exception_type            TEXT CHECK (char_length(exception_type) <= 256),
  level                     TEXT NOT NULL DEFAULT 'error' CHECK (level IN ('fatal','error','warning','info')),
  status                    TEXT NOT NULL DEFAULT 'unresolved' CHECK (status IN ('unresolved','investigating','resolved','ignored','archived')),

  first_seen_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_regressed_at         TIMESTAMPTZ,
  resolved_at               TIMESTAMPTZ,

  event_count               INTEGER NOT NULL DEFAULT 1,
  latest_event_id           UUID,
  fix_request_id            UUID REFERENCES fix_requests(id) ON DELETE SET NULL,
  assigned_to               UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_error_issues_project ON error_issues(error_project_id);
CREATE INDEX idx_error_issues_fingerprint ON error_issues(error_project_id, fingerprint);
CREATE INDEX idx_error_issues_status ON error_issues(error_project_id, status);
CREATE INDEX idx_error_issues_last_seen ON error_issues(error_project_id, last_seen_at DESC);
CREATE UNIQUE INDEX idx_error_issues_unique_fp ON error_issues(error_project_id, fingerprint);

-- Error Events (raw storage)
CREATE TABLE error_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              TEXT NOT NULL UNIQUE CHECK (char_length(event_id) <= 64),
  error_project_id      UUID NOT NULL REFERENCES error_projects(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL,

  source                TEXT NOT NULL DEFAULT 'browser_sdk' CHECK (source IN ('browser_sdk','manual','synthetic_analysis','server_sdk')),
  event_type            TEXT NOT NULL CHECK (event_type IN ('exception','unhandled_rejection','resource_error','network_error','message')),
  level                 TEXT NOT NULL DEFAULT 'error' CHECK (level IN ('fatal','error','warning','info')),

  message               TEXT NOT NULL CHECK (char_length(message) <= 2048),
  exception_type        TEXT CHECK (char_length(exception_type) <= 256),
  stack_frames          JSONB NOT NULL DEFAULT '[]',
  breadcrumbs           JSONB NOT NULL DEFAULT '[]',
  context               JSONB NOT NULL DEFAULT '{}',

  page_url_sanitized    TEXT CHECK (char_length(page_url_sanitized) <= 2048),
  route                 TEXT CHECK (char_length(route) <= 512),

  browser               TEXT CHECK (char_length(browser) <= 128),
  browser_version       TEXT CHECK (char_length(browser_version) <= 64),
  os                    TEXT CHECK (char_length(os) <= 64),
  device_category       TEXT CHECK (device_category IN ('desktop','mobile','tablet','unknown')),

  environment           TEXT CHECK (char_length(environment) <= 64),
  release               TEXT CHECK (char_length(release) <= 128),

  fingerprint           TEXT CHECK (char_length(fingerprint) <= 256),
  issue_id              UUID REFERENCES error_issues(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,

  is_test_event         BOOLEAN NOT NULL DEFAULT false,

  received_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occurred_at           TIMESTAMPTZ,
  processed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_error_events_project ON error_events(error_project_id, received_at DESC);
CREATE INDEX idx_error_events_issue ON error_events(issue_id, received_at DESC) WHERE issue_id IS NOT NULL;
CREATE INDEX idx_error_events_fingerprint ON error_events(error_project_id, fingerprint) WHERE fingerprint IS NOT NULL;

-- Issue activity log
CREATE TABLE error_issue_activities (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_issue_id   UUID NOT NULL REFERENCES error_issues(id) ON DELETE CASCADE,
  actor_user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type       TEXT NOT NULL,
  previous_value   TEXT,
  new_value        TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_error_issue_activities ON error_issue_activities(error_issue_id, created_at DESC);

-- Alert policies per project
CREATE TABLE error_alert_policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_project_id      UUID NOT NULL REFERENCES error_projects(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL,

  alert_type            TEXT NOT NULL CHECK (alert_type IN ('new_issue','fatal_issue','regression','event_spike')),
  is_enabled            BOOLEAN NOT NULL DEFAULT true,
  environment           TEXT DEFAULT 'production',
  min_level             TEXT DEFAULT 'error' CHECK (min_level IN ('fatal','error','warning','info')),
  cooldown_minutes      INTEGER NOT NULL DEFAULT 60,
  channels              JSONB NOT NULL DEFAULT '["email"]',
  spike_threshold       INTEGER DEFAULT 100,

  last_fired_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_error_alert_policies_project ON error_alert_policies(error_project_id);

-- Event quota tracking (monthly)
CREATE TABLE error_project_quotas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_project_id UUID NOT NULL REFERENCES error_projects(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL,
  month            TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  event_count      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(error_project_id, month)
);

-- RLS
ALTER TABLE error_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_issue_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_alert_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_project_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ep_select_own" ON error_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ep_insert_own" ON error_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ep_update_own" ON error_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ep_delete_own" ON error_projects FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "ep_service" ON error_projects FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "ee_select_own" ON error_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ee_service" ON error_events FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "ei_select_own" ON error_issues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ei_update_own" ON error_issues FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ei_service" ON error_issues FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "eia_select_own" ON error_issue_activities FOR SELECT USING (
  EXISTS (SELECT 1 FROM error_issues ei WHERE ei.id = error_issue_id AND ei.user_id = auth.uid())
);
CREATE POLICY "eia_service" ON error_issue_activities FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "eap_select_own" ON error_alert_policies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "eap_insert_own" ON error_alert_policies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "eap_update_own" ON error_alert_policies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "eap_delete_own" ON error_alert_policies FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "eap_service" ON error_alert_policies FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "epq_select_own" ON error_project_quotas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "epq_service" ON error_project_quotas FOR ALL USING (auth.role() = 'service_role');

-- Triggers
CREATE TRIGGER error_projects_updated_at BEFORE UPDATE ON error_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER error_issues_updated_at BEFORE UPDATE ON error_issues FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER error_alert_policies_updated_at BEFORE UPDATE ON error_alert_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER error_project_quotas_updated_at BEFORE UPDATE ON error_project_quotas FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RPC: resolve ingestion key
CREATE OR REPLACE FUNCTION resolve_error_project_key(p_key_hash TEXT)
RETURNS TABLE(
  project_id          UUID,
  user_id             UUID,
  normalized_origin   TEXT,
  allowed_origins     TEXT[],
  status              TEXT,
  sample_rate         NUMERIC,
  event_quota_monthly INTEGER,
  max_breadcrumbs     INTEGER
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id, user_id, normalized_origin, allowed_origins, status, sample_rate, event_quota_monthly, max_breadcrumbs
  FROM error_projects
  WHERE ingestion_key_hash = p_key_hash
  LIMIT 1;
$$;

-- RPC: increment monthly quota
CREATE OR REPLACE FUNCTION increment_error_event_quota(p_project_id UUID, p_user_id UUID, p_month TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INTEGER;
BEGIN
  INSERT INTO error_project_quotas(error_project_id, user_id, month, event_count)
  VALUES (p_project_id, p_user_id, p_month, 1)
  ON CONFLICT (error_project_id, month)
  DO UPDATE SET event_count = error_project_quotas.event_count + 1, updated_at = NOW()
  RETURNING event_count INTO v_count;
  RETURN v_count;
END;
$$;

-- RPC: upsert issue and increment count
CREATE OR REPLACE FUNCTION upsert_error_issue(
  p_project_id      UUID,
  p_user_id         UUID,
  p_fingerprint     TEXT,
  p_title           TEXT,
  p_exception_type  TEXT,
  p_level           TEXT,
  p_event_id        UUID
) RETURNS TABLE(issue_id UUID, is_regression BOOLEAN) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_issue_id     UUID;
  v_prev_status  TEXT;
  v_is_regression BOOLEAN := false;
BEGIN
  SELECT id, status INTO v_issue_id, v_prev_status
  FROM error_issues
  WHERE error_project_id = p_project_id AND fingerprint = p_fingerprint
  FOR UPDATE;

  IF v_issue_id IS NULL THEN
    INSERT INTO error_issues(error_project_id, user_id, fingerprint, title, exception_type, level, latest_event_id)
    VALUES (p_project_id, p_user_id, p_fingerprint, p_title, p_exception_type, p_level, p_event_id)
    RETURNING id INTO v_issue_id;
  ELSE
    IF v_prev_status = 'resolved' THEN
      v_is_regression := true;
    END IF;

    UPDATE error_issues SET
      event_count       = event_count + 1,
      last_seen_at      = NOW(),
      latest_event_id   = p_event_id,
      status            = CASE WHEN v_prev_status = 'resolved' THEN 'unresolved' ELSE status END,
      last_regressed_at = CASE WHEN v_prev_status = 'resolved' THEN NOW() ELSE last_regressed_at END,
      resolved_at       = CASE WHEN v_prev_status = 'resolved' THEN NULL ELSE resolved_at END,
      updated_at        = NOW()
    WHERE id = v_issue_id;
  END IF;

  RETURN QUERY SELECT v_issue_id, v_is_regression;
END;
$$;
