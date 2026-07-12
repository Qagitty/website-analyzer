-- ============================================================
-- 031_monitor_alert_evaluations.sql
-- Evaluation idempotency table for the alert pipeline.
--
-- One row per (monitor_id, analysis_id) pair.
-- The UNIQUE constraint on (monitor_id, analysis_id) is the
-- atomic gate: the pipeline inserts this row on entry and
-- aborts if the insert conflicts (duplicate callback).
-- ============================================================

CREATE TABLE IF NOT EXISTS monitor_alert_evaluations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id          UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  analysis_id         UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  run_id              UUID REFERENCES monitor_runs(id) ON DELETE SET NULL,
  evaluated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alerts_triggered    INTEGER NOT NULL DEFAULT 0,
  alerts_suppressed   INTEGER NOT NULL DEFAULT 0,
  result              JSONB,

  -- Idempotency gate: one evaluation per (monitor, analysis) pair
  UNIQUE (monitor_id, analysis_id)
);

CREATE INDEX IF NOT EXISTS idx_monitor_alert_evals_monitor_id
  ON monitor_alert_evaluations(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monitor_alert_evals_analysis_id
  ON monitor_alert_evaluations(analysis_id);
CREATE INDEX IF NOT EXISTS idx_monitor_alert_evals_evaluated_at
  ON monitor_alert_evaluations(evaluated_at DESC);

ALTER TABLE monitor_alert_evaluations ENABLE ROW LEVEL SECURITY;

-- Users can read their own monitor evaluations
CREATE POLICY "monitor_alert_evals_select_own" ON monitor_alert_evaluations
  FOR SELECT USING (
    monitor_id IN (
      SELECT id FROM monitors WHERE user_id = auth.uid()
    )
  );

-- Only service role can write (pipeline runs as service role)
CREATE POLICY "monitor_alert_evals_service_role" ON monitor_alert_evaluations
  FOR ALL USING (auth.role() = 'service_role');
