-- ============================================
-- Scheduled monitoring table
-- ============================================
CREATE TABLE monitors (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url                  TEXT NOT NULL,
  frequency            TEXT NOT NULL DEFAULT 'weekly'
                         CHECK (frequency IN ('daily', 'weekly')),
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_score_drop BOOLEAN NOT NULL DEFAULT TRUE,
  score_drop_threshold INTEGER NOT NULL DEFAULT 10,  -- alert if any score drops by this many points
  last_run_at          TIMESTAMPTZ,
  next_run_at          TIMESTAMPTZ NOT NULL,
  last_analysis_id     UUID REFERENCES analyses(id) ON DELETE SET NULL,
  last_scores          JSONB,                        -- cached scores from last run for comparison
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_monitors_user_id    ON monitors(user_id);
CREATE INDEX idx_monitors_next_run   ON monitors(next_run_at) WHERE is_active = TRUE;

-- Auto-update updated_at
CREATE TRIGGER monitors_updated_at
  BEFORE UPDATE ON monitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE monitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monitors_select_own" ON monitors
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "monitors_insert_own" ON monitors
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "monitors_update_own" ON monitors
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "monitors_delete_own" ON monitors
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "monitors_service_role" ON monitors
  FOR ALL USING (auth.role() = 'service_role');
