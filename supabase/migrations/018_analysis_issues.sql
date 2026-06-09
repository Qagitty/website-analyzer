-- ============================================================
-- 018_analysis_issues.sql
-- Structured issue rows extracted from ai_insights.insights JSONB.
-- Enables fast querying/filtering of the fix roadmap without
-- scanning the full JSONB column on every page load.
-- Populated by the AI callback handler when an analysis completes.
-- ============================================================

CREATE TABLE IF NOT EXISTS analysis_issues (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id      UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Issue identity (mirrors AIInsight type)
  category         TEXT NOT NULL
                     CHECK (category IN ('performance','accessibility','ux','seo','security')),
  priority         TEXT NOT NULL
                     CHECK (priority IN ('critical','high','medium','low')),
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  recommendation   TEXT NOT NULL,

  -- Scoring helpers (used for roadmap ordering)
  effort_level     TEXT CHECK (effort_level IN ('low','medium','high')),
  impact_score     SMALLINT CHECK (impact_score BETWEEN 0 AND 10),

  -- Code fix snippets (optional)
  before_code      TEXT,
  after_code       TEXT,

  -- WCAG reference (accessibility issues)
  wcag_reference   TEXT,

  -- Tracking / triage
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','in_progress','resolved','wont_fix')),
  notes            TEXT,
  assigned_to      TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common roadmap queries
CREATE INDEX IF NOT EXISTS idx_analysis_issues_analysis_id   ON analysis_issues(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_issues_user_id       ON analysis_issues(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_issues_category      ON analysis_issues(category);
CREATE INDEX IF NOT EXISTS idx_analysis_issues_priority      ON analysis_issues(priority);
CREATE INDEX IF NOT EXISTS idx_analysis_issues_status        ON analysis_issues(status);
CREATE INDEX IF NOT EXISTS idx_analysis_issues_impact        ON analysis_issues(impact_score DESC NULLS LAST);

-- Row Level Security
ALTER TABLE analysis_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analysis_issues_select_own" ON analysis_issues
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "analysis_issues_insert_own" ON analysis_issues
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "analysis_issues_update_own" ON analysis_issues
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "analysis_issues_delete_own" ON analysis_issues
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can write (AI callback writes on behalf of user)
CREATE POLICY "analysis_issues_service_role" ON analysis_issues
  FOR ALL USING (auth.role() = 'service_role');

-- Reuse the existing update_updated_at() trigger function
CREATE TRIGGER analysis_issues_updated_at
  BEFORE UPDATE ON analysis_issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
