-- ============================================================
-- Competitor comparisons table
-- Each record groups 2–5 analysis IDs (first = primary site)
-- ============================================================

CREATE TABLE IF NOT EXISTS comparisons (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_ids UUID[] NOT NULL,      -- ordered: first element = user's own site
  labels       TEXT[],               -- optional display labels per site
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comparisons_user_id ON comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_created_at ON comparisons(created_at DESC);

-- RLS
ALTER TABLE comparisons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comparisons_select_own" ON comparisons
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "comparisons_insert_own" ON comparisons
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comparisons_delete_own" ON comparisons
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "comparisons_service_role" ON comparisons
  FOR ALL USING (auth.role() = 'service_role');
