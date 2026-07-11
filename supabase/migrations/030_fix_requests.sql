-- ============================================================
-- 030_fix_requests.sql
-- Unified Audit and Fix Request Workflow
--
-- Design principles:
--   - External recipients never receive direct Supabase access
--   - All external access uses expiring signed tokens
--   - Internal notes are never exposed to external views
--   - Recipient contact details stored only as needed; minimized
--   - Phone numbers, emails stored only for delivery record, not profiled
-- ============================================================

-- ── Fix requests (core) ───────────────────────────────────────────────────────

CREATE TABLE fix_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id         UUID,

  -- Classification
  request_type    TEXT NOT NULL
    CHECK (request_type IN ('audit', 'fix', 'estimate', 'review', 'verification', 'consultation')),
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'ready', 'sending', 'sent', 'delivered', 'delivery_failed',
      'acknowledged', 'in_review', 'accepted', 'declined', 'in_progress',
      'waiting_for_information', 'fix_submitted', 'verification_required',
      'verified', 'closed', 'cancelled'
    )),
  severity        TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('critical', 'high', 'medium', 'low', 'informational')),

  -- Title and description
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  summary         TEXT CHECK (char_length(summary) <= 1000),
  technical_description TEXT CHECK (char_length(technical_description) <= 10000),
  category        TEXT,

  -- Source linkage
  source_type     TEXT NOT NULL
    CHECK (source_type IN (
      'analysis_finding', 'accessibility_finding', 'error_issue',
      'monitor_regression', 'security_finding', 'seo_finding',
      'design_mismatch', 'llm_readiness_finding', 'remediation_item', 'manual'
    )),
  source_id       TEXT,           -- ID in the source table (type-dependent)
  analysis_id     UUID,           -- Link to analyses row (optional)
  monitor_id      UUID,           -- Link to monitors row (optional)
  site_id         UUID,           -- Link to connected_sites (optional)

  -- Reproduction / steps
  affected_urls   TEXT[]  NOT NULL DEFAULT '{}',
  reproduction_steps TEXT[] NOT NULL DEFAULT '{}',
  verification_steps TEXT[] NOT NULL DEFAULT '{}',
  recommended_fix TEXT CHECK (char_length(recommended_fix) <= 10000),
  code_example    TEXT CHECK (char_length(code_example) <= 20000),

  -- Evidence (non-private evidence stored as JSONB array)
  -- Each item: { type, label, value, isPrivate }
  -- Private items must NOT be included in external delivery payloads
  evidence        JSONB NOT NULL DEFAULT '[]',

  -- Attachments metadata (actual files in private storage bucket)
  -- Each item: { storageKey, fileName, mimeType, fileSizeBytes, isPrivate, uploadedAt }
  attachments     JSONB NOT NULL DEFAULT '[]',

  -- Request priority and deadline
  requested_due_date    DATE,
  requested_priority    TEXT CHECK (requested_priority IN ('urgent', 'high', 'normal', 'low')),

  -- Delivery configuration
  -- Each item: { type, userId, teamMemberId, displayName, email, phoneE164,
  --             telegramUsername, webhookId }
  -- NOTE: external contact details (email, phone) stored for record only;
  -- never log these fields
  recipient_config JSONB NOT NULL DEFAULT '{}',
  delivery_channels TEXT[] NOT NULL DEFAULT '{}',

  -- Optional cover message to recipient
  -- SECURITY: char-length bounded; never logged raw
  cover_message   TEXT CHECK (char_length(cover_message) <= 5000),

  -- Outcome data (filled in by recipient via external link or internal flow)
  audit_response  JSONB,  -- AuditResponse shape (for audit-type requests)
  estimate        JSONB,  -- FixRequestEstimate shape (for estimate-type requests)
  verification_result TEXT
    CHECK (verification_result IN ('passed', 'failed', 'partially_passed', 'unable_to_verify')),
  verification_evidence JSONB,  -- VerificationEvidence[]

  -- Internal-only fields: NEVER sent to external recipients
  -- (enforced at application layer; also visible via RLS)
  internal_notes  TEXT,

  -- Soft-delete / archival
  is_archived     BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at     TIMESTAMPTZ,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fix_requests_user         ON fix_requests(user_id);
CREATE INDEX idx_fix_requests_status       ON fix_requests(user_id, status);
CREATE INDEX idx_fix_requests_source       ON fix_requests(source_type, source_id);
CREATE INDEX idx_fix_requests_analysis     ON fix_requests(analysis_id) WHERE analysis_id IS NOT NULL;
CREATE INDEX idx_fix_requests_created      ON fix_requests(created_at DESC);
CREATE INDEX idx_fix_requests_severity     ON fix_requests(user_id, severity, status);

-- ── Recipients (one row per intended recipient) ───────────────────────────────

CREATE TABLE fix_request_recipients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fix_request_id  UUID NOT NULL REFERENCES fix_requests(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  recipient_type  TEXT NOT NULL
    CHECK (recipient_type IN (
      'internal_user', 'team_member', 'email', 'whatsapp',
      'telegram', 'webhook', 'external_link'
    )),

  -- Internal references
  recipient_user_id   UUID,
  team_member_id      UUID,
  display_name        TEXT,

  -- External references (contact details; minimized; never logged)
  -- Stored masked in display; full values available only at send time
  recipient_email     TEXT,   -- validated before storage
  webhook_id          UUID,

  -- Phone for WhatsApp (E.164 format); only stored if needed for delivery
  phone_e164          TEXT,

  -- Telegram display only; Bot API requires chat_id obtained separately
  telegram_username   TEXT,

  -- Status for this specific recipient
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'failed', 'declined')),

  delivery_channel TEXT,

  -- Delivery evidence
  last_delivery_attempt   TIMESTAMPTZ,
  last_delivery_status    TEXT,
  delivery_error_summary  TEXT,   -- short error; never includes stack trace

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fix_req_recipients_request ON fix_request_recipients(fix_request_id);
CREATE INDEX idx_fix_req_recipients_user    ON fix_request_recipients(user_id);

-- ── Delivery log (immutable audit of all delivery attempts) ───────────────────

CREATE TABLE fix_request_deliveries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fix_request_id  UUID NOT NULL REFERENCES fix_requests(id) ON DELETE CASCADE,
  recipient_id    UUID REFERENCES fix_request_recipients(id) ON DELETE SET NULL,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  channel         TEXT NOT NULL,
  attempt_number  INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL
    CHECK (status IN ('prepared', 'accepted', 'delivered', 'failed', 'skipped')),

  -- Provider response (sanitized; secrets never stored here)
  provider_ref    TEXT,   -- e.g. Resend message ID, webhook HTTP status
  evidence_level  TEXT
    CHECK (evidence_level IN (
      'prepared', 'opened_external_app', 'accepted_by_provider',
      'delivered_by_provider', 'recipient_viewed', 'recipient_acknowledged'
    )),

  -- Error summary (short; never includes raw provider payloads or tokens)
  error_summary   TEXT,
  http_status     INTEGER,

  attempted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fix_req_deliveries_request ON fix_request_deliveries(fix_request_id);
CREATE INDEX idx_fix_req_deliveries_created ON fix_request_deliveries(attempted_at DESC);

-- ── Messages (conversation thread per request) ────────────────────────────────

CREATE TABLE fix_request_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fix_request_id  UUID NOT NULL REFERENCES fix_requests(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 'internal': visible only to owner+team; 'recipient_visible': shared externally
  visibility      TEXT NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('internal', 'recipient_visible')),

  format          TEXT NOT NULL DEFAULT 'text'
    CHECK (format IN ('text', 'markdown')),

  -- Content: length-bounded; never echoed verbatim in logs
  content         TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),

  -- Optional attachment (private bucket key only; actual content behind signed URL)
  attachment_storage_key TEXT,
  attachment_filename    TEXT,

  -- Sender context
  sender_display_name TEXT,
  sender_is_external  BOOLEAN NOT NULL DEFAULT FALSE,

  edited_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fix_req_messages_request ON fix_request_messages(fix_request_id);
CREATE INDEX idx_fix_req_messages_created ON fix_request_messages(created_at DESC);

-- ── Activity log (immutable lifecycle events) ─────────────────────────────────

CREATE TABLE fix_request_activities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fix_request_id  UUID NOT NULL REFERENCES fix_requests(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  event_type      TEXT NOT NULL,  -- FixRequestActivityEventType

  -- Before/after for status changes
  previous_status TEXT,
  new_status      TEXT,

  -- Additional safe metadata (no secrets, no PII beyond user_id)
  metadata        JSONB NOT NULL DEFAULT '{}',

  -- Actor info
  actor_is_external   BOOLEAN NOT NULL DEFAULT FALSE,
  actor_display_name  TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fix_req_activities_request ON fix_request_activities(fix_request_id);
CREATE INDEX idx_fix_req_activities_created ON fix_request_activities(created_at DESC);

-- ── Public / external links (scoped signed tokens) ───────────────────────────
--
-- External recipients receive a link with a scoped token.
-- They NEVER receive direct Supabase access.
-- Token is cryptographically random; expires; revocable.
-- Access is read-only for specific request fields only.

CREATE TABLE fix_request_public_links (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fix_request_id  UUID NOT NULL REFERENCES fix_requests(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- URL-safe token: hex(gen_random_bytes(32)), not derived from any secret
  token           TEXT NOT NULL UNIQUE,

  -- Access scope: what fields the external recipient may see
  -- 'standard': title, summary, category, affected_urls, steps, verification_steps
  -- 'full_technical': also technical_description, code_example, evidence (public only)
  access_scope    TEXT NOT NULL DEFAULT 'standard'
    CHECK (access_scope IN ('standard', 'full_technical')),

  -- Permitted actions for token holder
  can_view_messages   BOOLEAN NOT NULL DEFAULT FALSE,  -- recipient_visible only
  can_post_messages   BOOLEAN NOT NULL DEFAULT FALSE,
  can_acknowledge     BOOLEAN NOT NULL DEFAULT FALSE,
  can_submit_response BOOLEAN NOT NULL DEFAULT FALSE,  -- AuditResponse / Estimate

  -- Validity
  expires_at      TIMESTAMPTZ NOT NULL,
  is_revoked      BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at      TIMESTAMPTZ,

  -- Tracking (privacy-safe; no IP in application records)
  view_count      INTEGER NOT NULL DEFAULT 0,
  first_viewed_at TIMESTAMPTZ,
  last_viewed_at  TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fix_req_links_request ON fix_request_public_links(fix_request_id);
CREATE INDEX idx_fix_req_links_token   ON fix_request_public_links(token);
CREATE INDEX idx_fix_req_links_expires ON fix_request_public_links(expires_at) WHERE NOT is_revoked;

-- ── Row-Level Security ─────────────────────────────────────────────────────────

ALTER TABLE fix_requests              ENABLE ROW LEVEL SECURITY;
ALTER TABLE fix_request_recipients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fix_request_deliveries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fix_request_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fix_request_activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fix_request_public_links  ENABLE ROW LEVEL SECURITY;

-- fix_requests
CREATE POLICY "fix_requests_select_own" ON fix_requests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fix_requests_insert_own" ON fix_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fix_requests_update_own" ON fix_requests
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "fix_requests_delete_own" ON fix_requests
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "fix_requests_service" ON fix_requests
  FOR ALL USING (auth.role() = 'service_role');

-- fix_request_recipients
CREATE POLICY "fix_req_recipients_own" ON fix_request_recipients
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "fix_req_recipients_service" ON fix_request_recipients
  FOR ALL USING (auth.role() = 'service_role');

-- fix_request_deliveries
CREATE POLICY "fix_req_deliveries_own" ON fix_request_deliveries
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "fix_req_deliveries_service" ON fix_request_deliveries
  FOR ALL USING (auth.role() = 'service_role');

-- fix_request_messages
CREATE POLICY "fix_req_messages_select_own" ON fix_request_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fix_req_messages_insert_own" ON fix_request_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fix_req_messages_service" ON fix_request_messages
  FOR ALL USING (auth.role() = 'service_role');

-- fix_request_activities (append-only for users; service_role writes)
CREATE POLICY "fix_req_activities_select_own" ON fix_request_activities
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fix_req_activities_service" ON fix_request_activities
  FOR ALL USING (auth.role() = 'service_role');

-- fix_request_public_links
CREATE POLICY "fix_req_links_own" ON fix_request_public_links
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "fix_req_links_service" ON fix_request_public_links
  FOR ALL USING (auth.role() = 'service_role');

-- ── Triggers ──────────────────────────────────────────────────────────────────

CREATE TRIGGER fix_requests_updated_at
  BEFORE UPDATE ON fix_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER fix_req_recipients_updated_at
  BEFORE UPDATE ON fix_request_recipients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Helper: record a public-link view (atomic; no PII stored) ─────────────────

CREATE OR REPLACE FUNCTION fix_request_link_record_view(p_link_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE fix_request_public_links
  SET
    view_count      = view_count + 1,
    last_viewed_at  = NOW(),
    first_viewed_at = COALESCE(first_viewed_at, NOW())
  WHERE id = p_link_id
    AND NOT is_revoked
    AND expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
