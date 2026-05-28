-- ============================================================
-- 014_hardening.sql
-- Data integrity constraints and missing indexes.
-- ============================================================

-- ── Missing index on analyses.url ────────────────────────────
-- Enables efficient lookups when checking for duplicate URLs or
-- filtering analyses by URL (e.g. monitor deduplication).
CREATE INDEX IF NOT EXISTS idx_analyses_url ON analyses(url);

-- ── credits must never go negative ───────────────────────────
-- The use_credit() function guards against this in code, but a
-- DB-level constraint is the last line of defence against bugs
-- or direct SQL that bypasses the function.
-- NOTE: ADD CONSTRAINT IF NOT EXISTS is not valid PostgreSQL syntax;
-- use a DO block to make this migration idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'credits_non_negative'
      AND conrelid = 'user_settings'::regclass
  ) THEN
    ALTER TABLE user_settings
      ADD CONSTRAINT credits_non_negative CHECK (credits >= 0);
  END IF;
END $$;

-- ── credits_used must be non-negative ────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'credits_used_non_negative'
      AND conrelid = 'user_settings'::regclass
  ) THEN
    ALTER TABLE user_settings
      ADD CONSTRAINT credits_used_non_negative CHECK (credits_used >= 0);
  END IF;
END $$;

-- ── analyses.status is already constrained via CHECK in 001 ──
-- No change needed there.
