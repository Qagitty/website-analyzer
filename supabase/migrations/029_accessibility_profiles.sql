-- ============================================================
-- 029_accessibility_profiles.sql
-- Regional Accessibility Risk Assessment tables
--
-- NOTE ON COMPLIANCE LANGUAGE:
--   These tables store technical evidence for accessibility
--   assessments. Column names and values are scoped to
--   technical findings and risk indicators — NOT legal
--   compliance certifications. See application-layer
--   constraints for permitted status vocabulary.
-- ============================================================

-- ── Accessibility profiles ────────────────────────────────────────────────────

CREATE TABLE accessibility_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id         UUID,
  name            TEXT NOT NULL,

  -- Optional links to existing features
  connected_site_id UUID,
  monitor_id        UUID,

  -- Organization / service context (for applicability logic)
  target_markets        TEXT[]  NOT NULL DEFAULT '{}',
  organization_type     TEXT    NOT NULL DEFAULT 'unknown',
  service_categories    TEXT[]  NOT NULL DEFAULT '{}',

  -- Questionnaire answers (JSON blob keyed by question ID)
  applicability_answers JSONB   NOT NULL DEFAULT '{}',

  -- Selected standards and jurisdictions
  selected_standard_ids TEXT[]  NOT NULL DEFAULT '{}',

  -- Status
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  -- Profile-level settings
  preferred_language    TEXT    NOT NULL DEFAULT 'en',
  notification_settings JSONB   NOT NULL DEFAULT '{"on_new_blockers": true, "on_risk_increase": true}',

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_acc_profiles_user_id ON accessibility_profiles(user_id);
CREATE INDEX idx_acc_profiles_active  ON accessibility_profiles(user_id, is_active);

-- ── Profile regions (one row per jurisdiction tracked) ────────────────────────

CREATE TABLE accessibility_profile_regions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES accessibility_profiles(id) ON DELETE CASCADE,
  jurisdiction_id TEXT NOT NULL,
  profile_version TEXT NOT NULL,  -- jurisdiction profile version at time of selection

  -- Applicability result (cached from last assessment)
  applicability_result TEXT,
  applicability_cached_at TIMESTAMPTZ,

  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT acc_profile_regions_uq UNIQUE (profile_id, jurisdiction_id)
);

CREATE INDEX idx_acc_profile_regions_profile ON accessibility_profile_regions(profile_id);

-- ── Assessments ───────────────────────────────────────────────────────────────

CREATE TABLE accessibility_assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES accessibility_profiles(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  assessment_type TEXT NOT NULL DEFAULT 'single_page'
    CHECK (assessment_type IN ('single_page', 'multi_page', 'scheduled', 'manual_review', 'verification', 'baseline')),
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  -- Scope
  url             TEXT NOT NULL,
  pages_requested INTEGER NOT NULL DEFAULT 1,
  pages_completed INTEGER NOT NULL DEFAULT 0,

  -- Technical status (NOT a legal compliance label)
  technical_status TEXT
    CHECK (technical_status IN (
      'no_automated_blockers_detected',
      'potential_gaps_detected',
      'high_risk_gaps_detected',
      'manual_review_required',
      'insufficient_coverage'
    )),

  -- Risk assessment (computed, stored as JSONB)
  risk_dimensions JSONB,
  risk_level      TEXT
    CHECK (risk_level IN ('low', 'moderate', 'high', 'critical', 'insufficient_evidence')),
  risk_scope_note TEXT,

  -- Analysis linkage
  analysis_id     UUID,

  -- Timing
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_acc_assessments_profile   ON accessibility_assessments(profile_id);
CREATE INDEX idx_acc_assessments_user      ON accessibility_assessments(user_id);
CREATE INDEX idx_acc_assessments_status    ON accessibility_assessments(status);
CREATE INDEX idx_acc_assessments_created   ON accessibility_assessments(created_at DESC);

-- ── Assessment pages (per-page results for multi-page assessments) ─────────────

CREATE TABLE accessibility_assessment_pages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id   UUID NOT NULL REFERENCES accessibility_assessments(id) ON DELETE CASCADE,
  page_url        TEXT NOT NULL,
  is_critical_journey BOOLEAN NOT NULL DEFAULT FALSE,

  -- Page-level technical status
  technical_status TEXT,
  finding_count    INTEGER NOT NULL DEFAULT 0,
  critical_count   INTEGER NOT NULL DEFAULT 0,

  raw_findings     JSONB,  -- original findings from the engine (retained for re-analysis)
  assessed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT acc_assessment_pages_uq UNIQUE (assessment_id, page_url)
);

CREATE INDEX idx_acc_pages_assessment ON accessibility_assessment_pages(assessment_id);

-- ── Findings ──────────────────────────────────────────────────────────────────

CREATE TABLE accessibility_findings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES accessibility_profiles(id) ON DELETE CASCADE,
  assessment_id   UUID NOT NULL REFERENCES accessibility_assessments(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Stable identifier for tracking across assessments
  finding_key     TEXT NOT NULL,  -- hash(profile_id + rule_id + page_url + selector)

  -- Finding details (safe to store — no user PII, no disability data)
  page_url        TEXT NOT NULL,
  rule_id         TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('critical', 'serious', 'moderate', 'minor')),
  wcag_criteria   TEXT[] NOT NULL DEFAULT '{}',
  wcag_level      TEXT CHECK (wcag_level IN ('A', 'AA', 'AAA')),
  wcag_version    TEXT NOT NULL DEFAULT '2.1',
  is_critical_journey BOOLEAN NOT NULL DEFAULT FALSE,

  -- XSS-safe storage: selector and html are stored sanitized
  affected_selector       TEXT,
  sanitized_html_excerpt  TEXT,

  -- Lifecycle
  status          TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'verification_required', 'verified', 'accepted_risk', 'not_applicable')),
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  verified_at     TIMESTAMPTZ,

  -- Triage / tracking
  assigned_to_user_id UUID,
  private_notes   TEXT,  -- NEVER exported to public reports
  accepted_risk_reason TEXT,  -- required when status = 'accepted_risk'

  -- Standards mapping
  jurisdiction_ids TEXT[] NOT NULL DEFAULT '{}',

  -- Regression tracking
  regression_count INTEGER NOT NULL DEFAULT 0,
  last_regressed_at TIMESTAMPTZ,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_acc_findings_profile    ON accessibility_findings(profile_id);
CREATE INDEX idx_acc_findings_assessment ON accessibility_findings(assessment_id);
CREATE INDEX idx_acc_findings_status     ON accessibility_findings(profile_id, status);
CREATE INDEX idx_acc_findings_key        ON accessibility_findings(profile_id, finding_key);
CREATE INDEX idx_acc_findings_created    ON accessibility_findings(created_at DESC);

-- ── Manual check templates ────────────────────────────────────────────────────

CREATE TABLE accessibility_manual_checks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES accessibility_profiles(id) ON DELETE CASCADE,
  jurisdiction_id TEXT NOT NULL,
  check_id        TEXT NOT NULL,  -- from the jurisdiction's manualReviewRequirements

  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  wcag_criteria   TEXT[] NOT NULL DEFAULT '{}',
  wcag_level      TEXT CHECK (wcag_level IN ('A', 'AA', 'AAA')),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT acc_manual_checks_uq UNIQUE (profile_id, jurisdiction_id, check_id)
);

CREATE INDEX idx_acc_manual_checks_profile ON accessibility_manual_checks(profile_id);

-- ── Manual check results ──────────────────────────────────────────────────────

CREATE TABLE accessibility_manual_check_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id        UUID NOT NULL REFERENCES accessibility_manual_checks(id) ON DELETE CASCADE,
  assessment_id   UUID NOT NULL REFERENCES accessibility_assessments(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  status          TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'pass', 'fail', 'not_applicable', 'needs_expert_review')),

  -- Observations (private — not exported to public statements)
  observation_notes    TEXT,
  assistive_technology TEXT,

  -- Evidence reference (private storage bucket key)
  evidence_storage_key TEXT,
  evidence_description TEXT,

  performed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT acc_manual_results_uq UNIQUE (check_id, assessment_id)
);

CREATE INDEX idx_acc_manual_results_check      ON accessibility_manual_check_results(check_id);
CREATE INDEX idx_acc_manual_results_assessment ON accessibility_manual_check_results(assessment_id);

-- ── Accessibility statements ──────────────────────────────────────────────────

CREATE TABLE accessibility_statements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES accessibility_profiles(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jurisdiction_id TEXT NOT NULL,
  assessment_id   UUID REFERENCES accessibility_assessments(id),

  -- Always a draft until explicitly approved by the user
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready_for_review', 'approved', 'published', 'review_due', 'archived')),

  -- Statement content (editable by user)
  content         JSONB NOT NULL DEFAULT '{}',

  -- Versioning
  version         INTEGER NOT NULL DEFAULT 1,
  parent_id       UUID REFERENCES accessibility_statements(id),

  -- Dates
  statement_date  DATE,
  next_review_date DATE,
  published_at    TIMESTAMPTZ,
  review_due_at   TIMESTAMPTZ,
  archived_at     TIMESTAMPTZ,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_acc_statements_profile ON accessibility_statements(profile_id);
CREATE INDEX idx_acc_statements_status  ON accessibility_statements(profile_id, status);

-- ── Statement versions (append-only audit log of statement changes) ───────────

CREATE TABLE accessibility_statement_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id    UUID NOT NULL REFERENCES accessibility_statements(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  content         JSONB NOT NULL,
  change_summary  TEXT,
  changed_by      UUID NOT NULL REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_acc_stmt_versions_statement ON accessibility_statement_versions(statement_id);

-- ── Audit events ──────────────────────────────────────────────────────────────

CREATE TABLE accessibility_audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES accessibility_profiles(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  event_type      TEXT NOT NULL,
  entity_type     TEXT NOT NULL,  -- 'profile' | 'assessment' | 'finding' | 'manual_check' | 'statement'
  entity_id       UUID NOT NULL,

  -- Safe metadata only — no secrets, no PII beyond user_id
  metadata        JSONB NOT NULL DEFAULT '{}',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_acc_audit_profile ON accessibility_audit_events(profile_id);
CREATE INDEX idx_acc_audit_created ON accessibility_audit_events(created_at DESC);

-- ── Row-Level Security ─────────────────────────────────────────────────────────

ALTER TABLE accessibility_profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_profile_regions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_assessments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_assessment_pages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_findings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_manual_checks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_manual_check_results   ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_statements             ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_statement_versions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_audit_events           ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "acc_profiles_select_own" ON accessibility_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "acc_profiles_insert_own" ON accessibility_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "acc_profiles_update_own" ON accessibility_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "acc_profiles_delete_own" ON accessibility_profiles
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "acc_profiles_service_role" ON accessibility_profiles
  FOR ALL USING (auth.role() = 'service_role');

-- Profile regions
CREATE POLICY "acc_profile_regions_own" ON accessibility_profile_regions
  FOR ALL USING (
    profile_id IN (SELECT id FROM accessibility_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "acc_profile_regions_service" ON accessibility_profile_regions
  FOR ALL USING (auth.role() = 'service_role');

-- Assessments
CREATE POLICY "acc_assessments_select_own" ON accessibility_assessments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "acc_assessments_insert_own" ON accessibility_assessments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "acc_assessments_update_own" ON accessibility_assessments
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "acc_assessments_service" ON accessibility_assessments
  FOR ALL USING (auth.role() = 'service_role');

-- Assessment pages
CREATE POLICY "acc_assessment_pages_own" ON accessibility_assessment_pages
  FOR ALL USING (
    assessment_id IN (SELECT id FROM accessibility_assessments WHERE user_id = auth.uid())
  );
CREATE POLICY "acc_assessment_pages_service" ON accessibility_assessment_pages
  FOR ALL USING (auth.role() = 'service_role');

-- Findings
CREATE POLICY "acc_findings_select_own" ON accessibility_findings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "acc_findings_insert_own" ON accessibility_findings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "acc_findings_update_own" ON accessibility_findings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "acc_findings_service" ON accessibility_findings
  FOR ALL USING (auth.role() = 'service_role');

-- Manual checks
CREATE POLICY "acc_manual_checks_own" ON accessibility_manual_checks
  FOR ALL USING (
    profile_id IN (SELECT id FROM accessibility_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "acc_manual_checks_service" ON accessibility_manual_checks
  FOR ALL USING (auth.role() = 'service_role');

-- Manual check results
CREATE POLICY "acc_manual_results_own" ON accessibility_manual_check_results
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "acc_manual_results_service" ON accessibility_manual_check_results
  FOR ALL USING (auth.role() = 'service_role');

-- Statements
CREATE POLICY "acc_statements_select_own" ON accessibility_statements
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "acc_statements_insert_own" ON accessibility_statements
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "acc_statements_update_own" ON accessibility_statements
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "acc_statements_service" ON accessibility_statements
  FOR ALL USING (auth.role() = 'service_role');

-- Statement versions
CREATE POLICY "acc_stmt_versions_own" ON accessibility_statement_versions
  FOR ALL USING (
    statement_id IN (SELECT id FROM accessibility_statements WHERE user_id = auth.uid())
  );
CREATE POLICY "acc_stmt_versions_service" ON accessibility_statement_versions
  FOR ALL USING (auth.role() = 'service_role');

-- Audit events
CREATE POLICY "acc_audit_select_own" ON accessibility_audit_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "acc_audit_insert_own" ON accessibility_audit_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "acc_audit_service" ON accessibility_audit_events
  FOR ALL USING (auth.role() = 'service_role');

-- ── Triggers ──────────────────────────────────────────────────────────────────

CREATE TRIGGER acc_profiles_updated_at
  BEFORE UPDATE ON accessibility_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER acc_assessments_updated_at
  BEFORE UPDATE ON accessibility_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER acc_findings_updated_at
  BEFORE UPDATE ON accessibility_findings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER acc_manual_results_updated_at
  BEFORE UPDATE ON accessibility_manual_check_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER acc_statements_updated_at
  BEFORE UPDATE ON accessibility_statements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
