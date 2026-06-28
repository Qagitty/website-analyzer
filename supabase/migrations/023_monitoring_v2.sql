-- ============================================================
-- 023_monitoring_v2.sql — Monitoring domain v2
-- ============================================================
-- Adds three new tables (monitor_execution_leases, monitor_runs,
-- monitor_incidents) and extends the existing monitors table with
-- the new domain fields while preserving backward compatibility.
--
-- ALL ALTER TABLE statements use IF NOT EXISTS / IF EXISTS to be
-- idempotent — safe to re-run.
-- ============================================================

-- ─── Extend monitors table ────────────────────────────────────────────────────

ALTER TABLE monitors
  ADD COLUMN IF NOT EXISTS schema_version TEXT NOT NULL DEFAULT '2.0',
  ADD COLUMN IF NOT EXISTS normalized_root_url TEXT,
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  -- New schedule / scope / policy JSONB columns (null = use legacy fields)
  ADD COLUMN IF NOT EXISTS schedule JSONB,
  ADD COLUMN IF NOT EXISTS scope JSONB,
  ADD COLUMN IF NOT EXISTS comparison_policy JSONB,
  ADD COLUMN IF NOT EXISTS alert_policy JSONB,
  ADD COLUMN IF NOT EXISTS retention_policy JSONB,
  -- New lifecycle status column; legacy is_active maps to active/paused
  ADD COLUMN IF NOT EXISTS status TEXT
    CHECK (status IN ('active', 'paused', 'disabled', 'error', 'deleted')),
  -- Baseline policy
  ADD COLUMN IF NOT EXISTS baseline_policy TEXT
    CHECK (baseline_policy IN (
      'previous-comparable-run',
      'last-successful-run',
      'fixed-run',
      'rolling-median',
      'deployment-baseline'
    )),
  -- Last run reference (v2)
  ADD COLUMN IF NOT EXISTS last_run_id UUID;

-- Back-fill status from is_active for existing rows
UPDATE monitors
SET status = CASE WHEN is_active THEN 'active' ELSE 'paused' END
WHERE status IS NULL;

-- Back-fill normalized_root_url
UPDATE monitors
SET normalized_root_url = lower(trim(trailing '/' from url))
WHERE normalized_root_url IS NULL;

-- ─── monitor_execution_leases ─────────────────────────────────────────────────
-- Prevents duplicate execution when multiple cron workers fire simultaneously.
-- Claimed atomically via INSERT ON CONFLICT DO NOTHING.

CREATE TABLE IF NOT EXISTS monitor_execution_leases (
  monitor_id   UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  run_id       UUID NOT NULL,
  claimed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  claimed_by   TEXT NOT NULL DEFAULT 'cron',

  PRIMARY KEY (monitor_id)
);

CREATE INDEX IF NOT EXISTS idx_monitor_leases_expires
  ON monitor_execution_leases(expires_at);

-- ─── monitor_runs ─────────────────────────────────────────────────────────────
-- One row per scheduled execution. Stores the configuration snapshot so
-- historical comparisons remain explainable even after reconfiguration.

CREATE TABLE IF NOT EXISTS monitor_runs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id             UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  analysis_id            UUID REFERENCES analyses(id) ON DELETE SET NULL,
  scheduled_for          TIMESTAMPTZ NOT NULL,
  started_at             TIMESTAMPTZ,
  completed_at           TIMESTAMPTZ,
  status                 TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN (
      'scheduled', 'claimed', 'queued', 'running',
      'partial', 'completed', 'failed', 'cancelled', 'superseded'
    )),
  trigger                TEXT NOT NULL DEFAULT 'schedule'
    CHECK (trigger IN ('schedule', 'manual', 'deployment', 'retry')),
  attempt                INTEGER NOT NULL DEFAULT 1,
  -- Frozen at dispatch: enables future comparability validation
  configuration_snapshot JSONB,
  baseline_run_id        UUID REFERENCES monitor_runs(id) ON DELETE SET NULL,
  -- Populated after comparison is complete
  comparison_result      JSONB,
  alert_evaluation       JSONB,
  failure_origin         TEXT
    CHECK (failure_origin IN (
      'target-site', 'analyzer', 'browser-provider',
      'notification-provider', 'configuration', 'unknown'
    )),
  errors                 JSONB NOT NULL DEFAULT '[]',
  usage                  JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitor_runs_monitor_id
  ON monitor_runs(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monitor_runs_status
  ON monitor_runs(status);
CREATE INDEX IF NOT EXISTS idx_monitor_runs_scheduled_for
  ON monitor_runs(scheduled_for DESC);
CREATE INDEX IF NOT EXISTS idx_monitor_runs_analysis_id
  ON monitor_runs(analysis_id);

-- Auto-update updated_at
CREATE TRIGGER monitor_runs_updated_at
  BEFORE UPDATE ON monitor_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── monitor_incidents ────────────────────────────────────────────────────────
-- One row per unique alert fingerprint. Deduplicated per (monitor_id, fingerprint).
-- Never deleted — resolved incidents remain for audit trail.

CREATE TABLE IF NOT EXISTS monitor_incidents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id            UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  fingerprint           TEXT NOT NULL,
  title                 TEXT NOT NULL,
  severity              TEXT NOT NULL
    CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  status                TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'acknowledged', 'resolved', 'muted', 'reopened')),
  first_detected_run_id UUID REFERENCES monitor_runs(id) ON DELETE SET NULL,
  last_detected_run_id  UUID REFERENCES monitor_runs(id) ON DELETE SET NULL,
  resolved_run_id       UUID REFERENCES monitor_runs(id) ON DELETE SET NULL,
  affected_pages        JSONB NOT NULL DEFAULT '[]',
  event_history         JSONB NOT NULL DEFAULT '[]',
  occurrence_count      INTEGER NOT NULL DEFAULT 1,
  last_detected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Each monitor has at most one open incident per fingerprint
  UNIQUE (monitor_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_monitor_incidents_monitor_id
  ON monitor_incidents(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monitor_incidents_status
  ON monitor_incidents(status);
CREATE INDEX IF NOT EXISTS idx_monitor_incidents_fingerprint
  ON monitor_incidents(fingerprint);
CREATE INDEX IF NOT EXISTS idx_monitor_incidents_severity
  ON monitor_incidents(severity);

CREATE TRIGGER monitor_incidents_updated_at
  BEFORE UPDATE ON monitor_incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── RLS for new tables ───────────────────────────────────────────────────────

ALTER TABLE monitor_execution_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitor_runs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitor_incidents        ENABLE ROW LEVEL SECURITY;

-- monitor_execution_leases: service role only (internal cron mechanism)
CREATE POLICY "monitor_leases_service_role" ON monitor_execution_leases
  FOR ALL USING (auth.role() = 'service_role');

-- monitor_runs: users see only runs belonging to their monitors
CREATE POLICY "monitor_runs_select_own" ON monitor_runs
  FOR SELECT USING (
    monitor_id IN (
      SELECT id FROM monitors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "monitor_runs_service_role" ON monitor_runs
  FOR ALL USING (auth.role() = 'service_role');

-- monitor_incidents: users see only incidents belonging to their monitors
CREATE POLICY "monitor_incidents_select_own" ON monitor_incidents
  FOR SELECT USING (
    monitor_id IN (
      SELECT id FROM monitors WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "monitor_incidents_service_role" ON monitor_incidents
  FOR ALL USING (auth.role() = 'service_role');

-- ─── DB functions ─────────────────────────────────────────────────────────────

-- claim_monitor_run()
-- Atomically acquires a lease for the given monitor.
-- Returns the run_id if claim succeeded, NULL if already claimed.
--
-- Usage (from cron route):
--   SELECT claim_monitor_run(monitor_id := '...', p_run_id := '...', lease_minutes := 30);
CREATE OR REPLACE FUNCTION claim_monitor_run(
  p_monitor_id  UUID,
  p_run_id      UUID,
  lease_minutes INTEGER DEFAULT 30
)
RETURNS UUID AS $$
DECLARE
  v_result UUID;
BEGIN
  -- Remove any expired lease first (prevents stale lease from blocking)
  DELETE FROM monitor_execution_leases
  WHERE monitor_id = p_monitor_id
    AND expires_at < NOW();

  -- Atomic claim: INSERT ON CONFLICT DO NOTHING
  INSERT INTO monitor_execution_leases (monitor_id, run_id, expires_at)
  VALUES (
    p_monitor_id,
    p_run_id,
    NOW() + (lease_minutes || ' minutes')::INTERVAL
  )
  ON CONFLICT (monitor_id) DO NOTHING;

  -- Check whether we won the race
  SELECT run_id INTO v_result
  FROM monitor_execution_leases
  WHERE monitor_id = p_monitor_id AND run_id = p_run_id;

  RETURN v_result; -- NULL if another worker holds the lease
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- release_monitor_lease()
-- Releases a lease after the run completes (or fails) so the next cron
-- cycle can claim immediately without waiting for expiry.
CREATE OR REPLACE FUNCTION release_monitor_lease(
  p_monitor_id UUID,
  p_run_id     UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM monitor_execution_leases
  WHERE monitor_id = p_monitor_id AND run_id = p_run_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- cleanup_expired_monitor_leases()
-- Maintenance: removes all expired leases. Called at the start of each cron run.
CREATE OR REPLACE FUNCTION cleanup_expired_monitor_leases()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM monitor_execution_leases WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- upsert_monitor_incident()
-- Insert a new incident or update an existing open one.
-- Called by the alert evaluation layer in the cron route.
CREATE OR REPLACE FUNCTION upsert_monitor_incident(
  p_monitor_id             UUID,
  p_fingerprint            TEXT,
  p_title                  TEXT,
  p_severity               TEXT,
  p_run_id                 UUID,
  p_affected_pages         JSONB DEFAULT '[]',
  p_event_entry            JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_incident_id UUID;
BEGIN
  -- Try to update existing open/acknowledged/muted incident
  UPDATE monitor_incidents
  SET
    last_detected_run_id = p_run_id,
    last_detected_at     = NOW(),
    occurrence_count     = occurrence_count + 1,
    event_history        = event_history || p_event_entry,
    affected_pages       = p_affected_pages,
    -- Escalate severity but never de-escalate within an open incident
    severity = CASE
      WHEN p_severity = 'critical' THEN 'critical'
      WHEN p_severity = 'high'     AND severity <> 'critical' THEN 'high'
      ELSE severity
    END,
    -- Reopen if it was resolved
    status = CASE WHEN status = 'resolved' THEN 'reopened' ELSE status END,
    updated_at = NOW()
  WHERE monitor_id = p_monitor_id
    AND fingerprint = p_fingerprint
  RETURNING id INTO v_incident_id;

  IF v_incident_id IS NULL THEN
    -- Create new incident
    INSERT INTO monitor_incidents (
      monitor_id, fingerprint, title, severity, status,
      first_detected_run_id, last_detected_run_id,
      affected_pages, event_history, occurrence_count, last_detected_at
    )
    VALUES (
      p_monitor_id, p_fingerprint, p_title, p_severity, 'open',
      p_run_id, p_run_id,
      p_affected_pages, jsonb_build_array(p_event_entry), 1, NOW()
    )
    RETURNING id INTO v_incident_id;
  END IF;

  RETURN v_incident_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
