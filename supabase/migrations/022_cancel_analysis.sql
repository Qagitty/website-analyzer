-- Add 'cancelled' to the analyses status check constraint.
-- The original inline CHECK was auto-named analyses_status_check by PostgreSQL.

ALTER TABLE analyses DROP CONSTRAINT IF EXISTS analyses_status_check;

ALTER TABLE analyses ADD CONSTRAINT analyses_status_check
  CHECK (status IN ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled'));
