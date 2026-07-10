-- ============================================================
-- 026_monitor_pages_v2.sql
-- Aligns page_mode enum with spec §3:
--   homepage | important | all | custom
-- (replaces: homepage | pinned | sitemap | custom)
--
-- Adds aggregate fields to monitor_runs for multi-page tracking.
-- Adds importance_score to monitor_pages.
-- Safe to re-run (all operations guarded with IF NOT EXISTS / ON CONFLICT).
-- ============================================================

-- ── 1. Add new importance_score column to monitor_pages ───────────────────────
ALTER TABLE monitor_pages
  ADD COLUMN IF NOT EXISTS importance_score INTEGER NOT NULL DEFAULT 0;

-- ── 2. Add per-run page aggregate counters to monitor_runs ────────────────────
ALTER TABLE monitor_runs
  ADD COLUMN IF NOT EXISTS total_pages    INTEGER,
  ADD COLUMN IF NOT EXISTS queued_pages   INTEGER,
  ADD COLUMN IF NOT EXISTS completed_pages INTEGER,
  ADD COLUMN IF NOT EXISTS failed_pages   INTEGER;

-- ── 3. Update the page_mode CHECK constraint on monitors ─────────────────────
-- PostgreSQL does not support ALTER COLUMN ... DROP CONSTRAINT directly by name
-- on CHECK constraints in most versions. We drop and recreate the whole CHECK.
-- This is safe: the table already exists and we update existing enum values first.

-- Step 3a: Translate existing values before changing the constraint
UPDATE monitors SET page_mode = 'important' WHERE page_mode = 'pinned';
UPDATE monitors SET page_mode = 'all'       WHERE page_mode = 'sitemap';

-- Step 3b: Drop the old constraint (name from migration 025)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monitors_page_mode_check'
      AND conrelid = 'monitors'::regclass
  ) THEN
    ALTER TABLE monitors DROP CONSTRAINT monitors_page_mode_check;
  END IF;
END $$;

-- Step 3c: Add the new constraint with correct values
ALTER TABLE monitors
  ADD CONSTRAINT monitors_page_mode_check
  CHECK (page_mode IN ('homepage', 'important', 'all', 'custom'));

-- ── 4. Update page_type on monitor_pages (no change needed — root/pinned/discovered remain valid) ──

-- ── 5. Index on importance_score for ranking queries ────────────────────────
CREATE INDEX IF NOT EXISTS idx_monitor_pages_importance
  ON monitor_pages(monitor_id, importance_score DESC)
  WHERE is_active = TRUE;
