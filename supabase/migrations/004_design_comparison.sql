-- Add design comparison fields to analyses table
ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS design_screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS design_comparison     JSONB;
