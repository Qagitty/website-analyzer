-- ============================================================
-- Migration 027: Unified Queue Job Ledger
--
-- Provides a durable audit trail for all queue jobs.
-- Redis is the live queue; this table is the write-ahead log
-- for compliance, debugging, and DLQ management.
-- ============================================================

CREATE TABLE IF NOT EXISTS queue_job_ledger (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Envelope fields (denormalized for fast query)
  job_id          TEXT    NOT NULL UNIQUE,
  job_type        TEXT    NOT NULL,
  tenant_id       UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  correlation_id  TEXT,
  parent_job_id   TEXT,
  root_job_id     TEXT,
  idempotency_key TEXT,

  -- Scheduling
  priority        INTEGER NOT NULL DEFAULT 50,
  attempt         INTEGER NOT NULL DEFAULT 1,
  max_attempts    INTEGER NOT NULL DEFAULT 3,
  scheduled_for   TIMESTAMPTZ NOT NULL,
  expires_at      TIMESTAMPTZ,

  -- Outcome
  status          TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN (
                      'scheduled','ready','leased','running',
                      'retry_wait','completed','failed',
                      'dead_letter','cancelled','expired'
                    )),
  error_code      TEXT,
  -- Payload is NOT stored — security: no secrets or PII in ledger
  completed_at    TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qjl_tenant_id   ON queue_job_ledger(tenant_id);
CREATE INDEX IF NOT EXISTS idx_qjl_job_type    ON queue_job_ledger(job_type);
CREATE INDEX IF NOT EXISTS idx_qjl_status      ON queue_job_ledger(status);
CREATE INDEX IF NOT EXISTS idx_qjl_created_at  ON queue_job_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qjl_correlation ON queue_job_ledger(correlation_id)
  WHERE correlation_id IS NOT NULL;

-- Auto-update updated_at
CREATE TRIGGER queue_job_ledger_updated_at
  BEFORE UPDATE ON queue_job_ledger
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: tenant can only see their own jobs
ALTER TABLE queue_job_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qjl_select_own" ON queue_job_ledger
  FOR SELECT USING (auth.uid() = tenant_id);

CREATE POLICY "qjl_service_role" ON queue_job_ledger
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- DLQ jobs view — shows jobs that need operator attention
-- ============================================================
CREATE OR REPLACE VIEW queue_dlq_view AS
  SELECT
    job_id, job_type, tenant_id, correlation_id,
    attempt, max_attempts, error_code,
    scheduled_for, failed_at, created_at
  FROM queue_job_ledger
  WHERE status = 'dead_letter'
  ORDER BY failed_at DESC NULLS LAST;

COMMENT ON TABLE queue_job_ledger IS
  'Audit ledger for all unified queue jobs. Source of truth for compliance and DLQ review.';
