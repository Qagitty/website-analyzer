-- ============================================================
-- 017_remediation_items.sql
-- Remediation tracking for accessibility issues.
-- Each row tracks one WCAG violation from a specific analysis
-- through an open → in_progress → resolved → verified lifecycle.
-- ============================================================

CREATE TABLE IF NOT EXISTS remediation_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_id      UUID NOT NULL REFERENCES analyses(id)  ON DELETE CASCADE,
  url              TEXT NOT NULL,
  issue_id         TEXT NOT NULL,          -- axe-core rule id, e.g. "color-contrast"
  issue_description TEXT NOT NULL,
  impact           TEXT NOT NULL
                     CHECK (impact IN ('critical','serious','moderate','minor')),
  wcag_criteria    TEXT[] NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','in_progress','resolved','verified')),
  notes            TEXT,
  assigned_to      TEXT,
  due_date         DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_remediation_user_id     ON remediation_items(user_id);
CREATE INDEX IF NOT EXISTS idx_remediation_analysis_id ON remediation_items(analysis_id);
CREATE INDEX IF NOT EXISTS idx_remediation_status      ON remediation_items(status);

-- Row Level Security
ALTER TABLE remediation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "remediation_select_own" ON remediation_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "remediation_insert_own" ON remediation_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "remediation_update_own" ON remediation_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "remediation_delete_own" ON remediation_items
  FOR DELETE USING (auth.uid() = user_id);

-- Reuse the existing update_updated_at() trigger function
CREATE TRIGGER remediation_updated_at
  BEFORE UPDATE ON remediation_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
