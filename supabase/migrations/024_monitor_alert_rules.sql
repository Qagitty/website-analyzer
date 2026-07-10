-- ============================================================
-- 024_monitor_alert_rules.sql
-- Per-monitor configurable alert rules (Phase 8 of spec).
-- ============================================================

-- Add paused_at timestamp to monitors
ALTER TABLE monitors
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

-- ─── monitor_alert_rules ─────────────────────────────────────────────────────
-- Each row is one user-defined rule on a monitor.
-- Evaluations happen in the callback after each completed run.

CREATE TABLE IF NOT EXISTS monitor_alert_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id    UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  name          TEXT NOT NULL,
  -- The metric this rule watches (e.g. 'performance', 'accessibility', 'lcp')
  metric        TEXT NOT NULL,
  -- Comparison operator
  operator      TEXT NOT NULL CHECK (operator IN (
    'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL',
    'DECREASE_BY', 'DECREASE_BY_PERCENT', 'INCREASE_BY', 'INCREASE_BY_PERCENT',
    'CHANGED', 'BECAME_TRUE', 'BECAME_FALSE'
  )),
  -- Numeric threshold (null for CHANGED/BECAME_TRUE/BECAME_FALSE)
  threshold     NUMERIC,
  severity      TEXT NOT NULL DEFAULT 'WARNING' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  -- How many consecutive failing runs before alert fires
  consecutive_failures_required INTEGER NOT NULL DEFAULT 1,
  -- How many consecutive healthy runs before alert resolves
  recovery_runs_required INTEGER NOT NULL DEFAULT 1,
  -- Cooldown: don't re-notify for this many minutes after an alert fires
  cooldown_minutes INTEGER NOT NULL DEFAULT 1440,
  notify_on_recovery BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitor_alert_rules_monitor_id
  ON monitor_alert_rules(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monitor_alert_rules_enabled
  ON monitor_alert_rules(monitor_id, enabled);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'monitor_alert_rules_updated_at'
      AND tgrelid = 'monitor_alert_rules'::regclass
  ) THEN
    CREATE TRIGGER monitor_alert_rules_updated_at
      BEFORE UPDATE ON monitor_alert_rules
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE monitor_alert_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'monitor_alert_rules_select_own' AND tablename = 'monitor_alert_rules') THEN
    CREATE POLICY "monitor_alert_rules_select_own" ON monitor_alert_rules
      FOR SELECT USING (monitor_id IN (SELECT id FROM monitors WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'monitor_alert_rules_insert_own' AND tablename = 'monitor_alert_rules') THEN
    CREATE POLICY "monitor_alert_rules_insert_own" ON monitor_alert_rules
      FOR INSERT WITH CHECK (monitor_id IN (SELECT id FROM monitors WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'monitor_alert_rules_update_own' AND tablename = 'monitor_alert_rules') THEN
    CREATE POLICY "monitor_alert_rules_update_own" ON monitor_alert_rules
      FOR UPDATE USING (monitor_id IN (SELECT id FROM monitors WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'monitor_alert_rules_delete_own' AND tablename = 'monitor_alert_rules') THEN
    CREATE POLICY "monitor_alert_rules_delete_own" ON monitor_alert_rules
      FOR DELETE USING (monitor_id IN (SELECT id FROM monitors WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'monitor_alert_rules_service_role' AND tablename = 'monitor_alert_rules') THEN
    CREATE POLICY "monitor_alert_rules_service_role" ON monitor_alert_rules
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
