-- Allow reports to be shared publicly
ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_analyses_is_public ON analyses(is_public)
  WHERE is_public = TRUE;

-- Public read policy: anyone can read a report that has been made public
CREATE POLICY "analyses_select_public" ON analyses
  FOR SELECT USING (is_public = TRUE);
