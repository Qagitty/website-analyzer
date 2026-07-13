-- ============================================================
-- 033_accessibility_workflow.sql
-- Accessibility End-to-End Workflow — Sprint 17
--
-- LANGUAGE CONSTRAINTS (never relax these):
--   Never use: "guaranteed compliance", "certified", "immune from fines",
--              "100% compliant", "guaranteed legal protection"
--   Always use: "Regional accessibility risk assessment",
--               "Accessibility readiness", "Technical conformance evidence",
--               "Potential compliance gaps", "DRAFT — Review before publication"
-- ============================================================

-- ── 1. Extend accessibility_profiles with new columns ─────────────────────────
-- Add columns the Sprint 17 workflow needs (IF NOT EXISTS is safe on Postgres 9.6+)

ALTER TABLE accessibility_profiles
  ADD COLUMN IF NOT EXISTS public_sector        BOOLEAN,
  ADD COLUMN IF NOT EXISTS provides_consumer_services BOOLEAN,
  ADD COLUMN IF NOT EXISTS selected_standards   TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assessment_page_mode TEXT      NOT NULL DEFAULT 'homepage'
    CHECK (assessment_page_mode IN ('homepage','important','all','custom')),
  ADD COLUMN IF NOT EXISTS status               TEXT      NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','archived')),
  ADD COLUMN IF NOT EXISTS schedule             JSONB;

-- ── 2. accessibility_critical_journeys ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS accessibility_critical_journeys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES accessibility_profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  priority    INT  NOT NULL DEFAULT 1 CHECK (priority >= 1 AND priority <= 10),
  enabled     BOOLEAN NOT NULL DEFAULT true,
  page_urls   TEXT[]  NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acc_journeys_profile ON accessibility_critical_journeys(profile_id);

-- ── 3. Extend accessibility_assessments ──────────────────────────────────────

ALTER TABLE accessibility_assessments
  ADD COLUMN IF NOT EXISTS type                   TEXT NOT NULL DEFAULT 'single_page'
    CHECK (type IN ('baseline','scheduled','manual','verification','single_page','multi_page')),
  ADD COLUMN IF NOT EXISTS page_count             INT  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pages_failed           INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS standards_snapshot     JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS jurisdictions_snapshot JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS engine_version         TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS ruleset_version        TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS coverage_percent       NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_coverage_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS journey_coverage_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_checks_required INT  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS manual_checks_completed INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_result            JSONB,
  ADD COLUMN IF NOT EXISTS risk_model_version     TEXT NOT NULL DEFAULT '1.0';

-- ── 4. Extend accessibility_assessment_pages ─────────────────────────────────

ALTER TABLE accessibility_assessment_pages
  ADD COLUMN IF NOT EXISTS normalized_url         TEXT,
  ADD COLUMN IF NOT EXISTS monitor_page_id        UUID,
  ADD COLUMN IF NOT EXISTS analysis_id            UUID REFERENCES analyses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status                 TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','skipped')),
  ADD COLUMN IF NOT EXISTS automated_findings_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_code             TEXT,
  ADD COLUMN IF NOT EXISTS started_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at           TIMESTAMPTZ;

-- Back-fill normalized_url with page_url where NULL
UPDATE accessibility_assessment_pages
SET normalized_url = page_url
WHERE normalized_url IS NULL;

-- Make normalized_url NOT NULL now that it's back-filled
ALTER TABLE accessibility_assessment_pages
  ALTER COLUMN normalized_url SET NOT NULL;

-- Update unique constraint to use normalized_url (drop old, add new)
-- (The old unique was on (assessment_id, page_url) — keep that too for now)
CREATE UNIQUE INDEX IF NOT EXISTS idx_acc_pages_assessment_norm
  ON accessibility_assessment_pages(assessment_id, normalized_url);

-- ── 5. Extend accessibility_findings ─────────────────────────────────────────

ALTER TABLE accessibility_findings
  ADD COLUMN IF NOT EXISTS page_id               UUID REFERENCES accessibility_assessment_pages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS impact                TEXT
    CHECK (impact IN ('critical','serious','moderate','minor')),
  ADD COLUMN IF NOT EXISTS selector              TEXT,
  ADD COLUMN IF NOT EXISTS html_excerpt          TEXT,
  ADD COLUMN IF NOT EXISTS wcag_level            TEXT,
  ADD COLUMN IF NOT EXISTS pour_principle        TEXT
    CHECK (pour_principle IN ('perceivable','operable','understandable','robust')),
  ADD COLUMN IF NOT EXISTS automated             BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS jurisdiction_relevance JSONB  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS remediation_guidance  TEXT,
  ADD COLUMN IF NOT EXISTS fingerprint           TEXT,
  ADD COLUMN IF NOT EXISTS remediation_id        UUID,
  ADD COLUMN IF NOT EXISTS fix_request_id        UUID,
  ADD COLUMN IF NOT EXISTS verified_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_risk_review_date DATE,
  ADD COLUMN IF NOT EXISTS not_applicable_reason TEXT;

-- Back-fill fingerprint from existing finding_key where NULL
UPDATE accessibility_findings SET fingerprint = finding_key WHERE fingerprint IS NULL;

-- Index for fingerprint deduplication
CREATE INDEX IF NOT EXISTS idx_acc_findings_fingerprint
  ON accessibility_findings(profile_id, fingerprint);

-- ── 6. accessibility_manual_check_catalog (global, not per-profile) ───────────

CREATE TABLE IF NOT EXISTS accessibility_manual_check_catalog (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_key             TEXT NOT NULL UNIQUE,
  version               TEXT NOT NULL DEFAULT '1.0',
  title                 TEXT NOT NULL,
  purpose               TEXT NOT NULL,
  steps                 TEXT[] NOT NULL DEFAULT '{}',
  expected_result       TEXT NOT NULL,
  applicable_standards  TEXT[] NOT NULL DEFAULT '{}',
  applicable_page_types TEXT[] NOT NULL DEFAULT '{}',
  evidence_requirement  TEXT,
  expert_review_required BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS needed for read; catalog is not user-specific
-- Insert 22 canonical manual checks
INSERT INTO accessibility_manual_check_catalog
  (check_key, title, purpose, steps, expected_result, applicable_standards, applicable_page_types, expert_review_required)
VALUES
  ('keyboard_navigation',
   'Keyboard Navigation',
   'Verify all interactive content is reachable and operable via keyboard alone.',
   ARRAY[
     'Open the page without a mouse or touchpad.',
     'Press Tab to move through focusable elements.',
     'Press Shift+Tab to move backwards.',
     'Use Enter/Space to activate buttons and links.',
     'Verify all forms, menus, and dialogs are reachable.'
   ],
   'All interactive elements are reachable and operable without a mouse.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa','section_508_web'],
   ARRAY['all'],
   false),

  ('focus_order',
   'Focus Order',
   'Verify the focus order matches the visual reading order and is logical.',
   ARRAY[
     'Tab through the page from the top.',
     'Note the sequence in which focus moves between elements.',
     'Compare focus order with the visual layout.'
   ],
   'Focus order is top-to-bottom, left-to-right and matches reading order.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa'],
   ARRAY['all'],
   false),

  ('visible_focus',
   'Visible Focus Indicator',
   'Verify keyboard focus is always visibly indicated.',
   ARRAY[
     'Tab through all interactive elements.',
     'Observe whether a visible focus ring or indicator appears on each element.',
     'Check all states: default, hover, focus.'
   ],
   'Every focusable element shows a clearly visible focus indicator.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa'],
   ARRAY['all'],
   false),

  ('keyboard_traps',
   'Keyboard Traps',
   'Verify that focus is never trapped in a component (unless intentional modal).',
   ARRAY[
     'Tab into each interactive widget, modal, and menu.',
     'Attempt to Tab or Escape out of each component.',
     'Verify focus can always return to the main content.'
   ],
   'Users can always move focus out of any component using standard keys.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa'],
   ARRAY['all'],
   false),

  ('screen_reader_labels',
   'Screen Reader Labels',
   'Verify all interactive elements and images have meaningful accessible names.',
   ARRAY[
     'Enable a screen reader (NVDA, JAWS, VoiceOver, or TalkBack).',
     'Navigate to each button, link, form control, and image.',
     'Listen to the announced label.',
     'Confirm labels are descriptive and unique.'
   ],
   'All interactive elements and images have meaningful, descriptive labels announced by screen readers.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa','section_508_web'],
   ARRAY['all'],
   true),

  ('alternative_text_quality',
   'Alternative Text Quality',
   'Verify that alternative text for images conveys equivalent meaning.',
   ARRAY[
     'Identify all images (decorative and informative).',
     'For decorative images: verify alt="" or role="presentation".',
     'For informative images: verify alt text describes the content or function.',
     'For complex charts/graphs: verify a text description is provided.'
   ],
   'Informative images have accurate alt text; decorative images are hidden from assistive technology.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa'],
   ARRAY['all'],
   false),

  ('form_instructions',
   'Form Instructions and Labels',
   'Verify forms have clear labels, instructions, and error messages.',
   ARRAY[
     'Navigate to each form on the page.',
     'Verify every input has a visible, programmatically associated label.',
     'Verify required fields are indicated.',
     'Verify format instructions are provided before submission.'
   ],
   'All form fields have clear labels, format hints, and required indicators.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa'],
   ARRAY['forms'],
   false),

  ('error_identification',
   'Error Identification and Recovery',
   'Verify form errors are clearly identified and recovery instructions are provided.',
   ARRAY[
     'Submit a form with intentional errors.',
     'Observe error messages.',
     'Verify the errored field is identified by name.',
     'Verify a clear description of the error is provided.',
     'Verify instructions for correction are given.'
   ],
   'Errors are clearly identified in text, describe the issue, and suggest a fix.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa'],
   ARRAY['forms'],
   false),

  ('status_announcements',
   'Status and Live Region Announcements',
   'Verify dynamic status messages are announced to screen reader users.',
   ARRAY[
     'Enable a screen reader.',
     'Trigger status messages (form success, loading, alerts).',
     'Verify messages are announced without moving focus.',
     'Check aria-live regions are present and configured correctly.'
   ],
   'Status updates are announced to screen readers without requiring focus movement.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa'],
   ARRAY['all'],
   true),

  ('captions',
   'Captions for Video',
   'Verify all pre-recorded video content has accurate captions.',
   ARRAY[
     'Identify all video content on the page.',
     'Enable captions/subtitles for each video.',
     'Compare captions with the audio track.',
     'Verify captions are synchronized, complete, and accurate.'
   ],
   'All pre-recorded video has accurate, synchronized captions.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa','section_508_web'],
   ARRAY['media'],
   false),

  ('transcripts',
   'Transcripts for Audio and Video',
   'Verify audio and video content has text transcripts.',
   ARRAY[
     'Identify all audio-only and video content.',
     'Locate transcripts for each media item.',
     'Verify transcripts are complete and accurate.',
     'Verify transcripts include speaker identification.'
   ],
   'Text transcripts are provided for all audio and video content.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa'],
   ARRAY['media'],
   false),

  ('audio_descriptions',
   'Audio Descriptions for Video',
   'Verify pre-recorded video with visual-only content has audio descriptions.',
   ARRAY[
     'Identify videos where important visual information is not conveyed in the audio.',
     'Verify an audio description track or extended description is available.',
     'Verify the audio description accurately describes the visual content.'
   ],
   'Visual-only content in video has audio descriptions or extended text descriptions.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa'],
   ARRAY['media'],
   false),

  ('zoom_reflow',
   'Zoom and Reflow',
   'Verify content reflows and remains usable at 400% browser zoom without horizontal scrolling.',
   ARRAY[
     'Set browser zoom to 400%.',
     'Verify all content reflows into a single column.',
     'Verify no content is lost or hidden.',
     'Verify horizontal scrolling is not required for reading content.'
   ],
   'Content reflows at 400% zoom without horizontal scrolling or loss of information.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa'],
   ARRAY['all'],
   false),

  ('orientation',
   'Orientation Lock',
   'Verify content does not restrict viewing to one orientation (portrait or landscape).',
   ARRAY[
     'View the page in portrait orientation.',
     'Rotate device to landscape orientation.',
     'Verify content adapts to both orientations.',
     'Verify no content is lost or unusable in either orientation.'
   ],
   'Content displays and functions correctly in both portrait and landscape orientations.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa'],
   ARRAY['all'],
   false),

  ('drag_alternatives',
   'Alternatives to Drag Operations',
   'Verify that all drag-and-drop functionality can be accomplished with simple pointer or keyboard actions.',
   ARRAY[
     'Identify all drag-and-drop interactions.',
     'Attempt to accomplish the same task using single click/tap actions.',
     'Attempt to accomplish the same task using keyboard controls.',
     'Verify at least one non-drag alternative exists for each drag operation.'
   ],
   'All drag operations have a single-pointer and/or keyboard alternative.',
   ARRAY['wcag_2_2_aa'],
   ARRAY['all'],
   false),

  ('authentication_accessibility',
   'Accessible Authentication',
   'Verify authentication does not rely solely on cognitive function tests.',
   ARRAY[
     'Attempt to log in or authenticate.',
     'Verify no step requires solving a cognitive puzzle (transcribing text, solving math) without an alternative.',
     'Verify CAPTCHA has an audio or other alternative.',
     'Verify pasting credentials into password fields is allowed.'
   ],
   'Authentication is possible without relying on cognitive function tests that lack an alternative.',
   ARRAY['wcag_2_2_aa'],
   ARRAY['auth'],
   false),

  ('timeout_behavior',
   'Timeout Warnings and Extensions',
   'Verify users are warned before a timeout and can extend the session.',
   ARRAY[
     'Identify any timed sessions (inactivity logout, form expiry).',
     'Verify users are warned at least 20 seconds before timeout.',
     'Verify users can extend or turn off the timeout.',
     'Verify data is not lost if the timeout occurs.'
   ],
   'Users are warned before session timeouts and can extend or turn off time limits.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa'],
   ARRAY['auth','forms'],
   false),

  ('modal_focus_management',
   'Modal Dialog Focus Management',
   'Verify modal dialogs trap focus correctly and return focus on close.',
   ARRAY[
     'Open a modal dialog using keyboard (Enter/Space).',
     'Verify focus moves into the modal.',
     'Verify Tab key cycles only within the modal while it is open.',
     'Close the modal (Escape or Close button).',
     'Verify focus returns to the element that triggered the modal.'
   ],
   'Modal dialogs trap focus when open and return focus to the trigger on close.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa'],
   ARRAY['all'],
   false),

  ('reading_order',
   'Reading Order',
   'Verify the DOM reading order matches the visual presentation.',
   ARRAY[
     'Enable a screen reader.',
     'Navigate the page using the reading cursor (not Tab key).',
     'Compare the announced reading order with the visual layout.',
     'Verify headings, lists, and content are announced in logical order.'
   ],
   'The DOM order matches the visual reading order and is logical to screen reader users.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa'],
   ARRAY['all'],
   true),

  ('language_changes',
   'Language Identification for Content Changes',
   'Verify inline language changes are programmatically identified.',
   ARRAY[
     'Identify any text in a language different from the page language.',
     'Inspect the HTML for lang attributes on inline elements.',
     'Verify the lang attribute matches the language of the text.'
   ],
   'Inline text in a different language has the appropriate lang attribute.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa'],
   ARRAY['all'],
   false),

  ('target_size',
   'Target Size for Pointer Inputs',
   'Verify interactive targets meet minimum size requirements.',
   ARRAY[
     'Identify small interactive targets (buttons, links, checkboxes).',
     'Measure their dimensions using browser DevTools.',
     'Verify targets are at least 24×24 CSS pixels (WCAG 2.2) or 44×44 CSS pixels recommended.',
     'Verify targets that are smaller have sufficient spacing from adjacent targets.'
   ],
   'Interactive targets are at least 24×24 CSS pixels or have adequate spacing from adjacent targets.',
   ARRAY['wcag_2_2_aa'],
   ARRAY['all'],
   false),

  ('cognitive_clarity',
   'Cognitive Clarity and Consistency',
   'Verify navigation, labeling, and interaction patterns are consistent throughout the site.',
   ARRAY[
     'Compare navigation elements across multiple pages.',
     'Verify navigation is in the same position and order on each page.',
     'Verify labels for identical controls are consistent.',
     'Verify icons are consistently used with the same meaning.',
     'Verify no unexpected context changes occur without user initiation.'
   ],
   'Navigation, labels, and interaction patterns are consistent throughout the site and follow predictable conventions.',
   ARRAY['wcag_2_1_aa','wcag_2_2_aa'],
   ARRAY['all'],
   false)
ON CONFLICT (check_key) DO NOTHING;

-- ── 7. Update accessibility_manual_check_results to reference catalog ─────────
-- Add catalog reference and additional fields

ALTER TABLE accessibility_manual_check_results
  ADD COLUMN IF NOT EXISTS catalog_check_id  UUID REFERENCES accessibility_manual_check_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS page_id           UUID REFERENCES accessibility_assessment_pages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS journey_id        UUID REFERENCES accessibility_critical_journeys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes             TEXT,
  ADD COLUMN IF NOT EXISTS evidence          JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS reviewed_at       TIMESTAMPTZ;

-- ── 8. accessibility_activities (generic audit log) ───────────────────────────

CREATE TABLE IF NOT EXISTS accessibility_activities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    UUID REFERENCES accessibility_profiles(id) ON DELETE SET NULL,
  assessment_id UUID REFERENCES accessibility_assessments(id) ON DELETE SET NULL,
  finding_id    UUID,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL,
  event_data    JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acc_activities_profile    ON accessibility_activities(profile_id);
CREATE INDEX IF NOT EXISTS idx_acc_activities_assessment ON accessibility_activities(assessment_id);
CREATE INDEX IF NOT EXISTS idx_acc_activities_created    ON accessibility_activities(created_at DESC);

-- ── 9. Extend accessibility_statements ───────────────────────────────────────

ALTER TABLE accessibility_statements
  ADD COLUMN IF NOT EXISTS template_version   TEXT NOT NULL DEFAULT '2026.1',
  ADD COLUMN IF NOT EXISTS created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_version_id UUID;

-- ── 10. Add version_number to accessibility_statement_versions ────────────────

ALTER TABLE accessibility_statement_versions
  ADD COLUMN IF NOT EXISTS version_number     INT,
  ADD COLUMN IF NOT EXISTS source_snapshot    JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS created_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Back-fill version_number from version where NULL
UPDATE accessibility_statement_versions
SET version_number = version
WHERE version_number IS NULL;

-- ── 11. Additional indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_acc_assessments_profile_v2  ON accessibility_assessments(profile_id);
CREATE INDEX IF NOT EXISTS idx_acc_assessment_pages_status ON accessibility_assessment_pages(assessment_id, status);
CREATE INDEX IF NOT EXISTS idx_acc_manual_results_assessment_v2 ON accessibility_manual_check_results(assessment_id);
CREATE INDEX IF NOT EXISTS idx_acc_statements_profile_v2   ON accessibility_statements(profile_id);

-- ── 12. RLS for new tables ───────────────────────────────────────────────────

ALTER TABLE accessibility_critical_journeys  ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_manual_check_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessibility_activities           ENABLE ROW LEVEL SECURITY;

-- Critical journeys: owned by profile owner
CREATE POLICY "acc_journeys_own" ON accessibility_critical_journeys
  FOR ALL USING (
    profile_id IN (SELECT id FROM accessibility_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "acc_journeys_service" ON accessibility_critical_journeys
  FOR ALL USING (auth.role() = 'service_role');

-- Manual check catalog: public read, service write
CREATE POLICY "acc_catalog_public_read" ON accessibility_manual_check_catalog
  FOR SELECT USING (true);
CREATE POLICY "acc_catalog_service_write" ON accessibility_manual_check_catalog
  FOR ALL USING (auth.role() = 'service_role');

-- Activities: insert by authenticated users (own profile), select by profile owner
CREATE POLICY "acc_activities_select_own" ON accessibility_activities
  FOR SELECT USING (
    profile_id IN (SELECT id FROM accessibility_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "acc_activities_insert_own" ON accessibility_activities
  FOR INSERT WITH CHECK (
    profile_id IN (SELECT id FROM accessibility_profiles WHERE user_id = auth.uid())
    OR auth.uid() = user_id
  );
CREATE POLICY "acc_activities_service" ON accessibility_activities
  FOR ALL USING (auth.role() = 'service_role');

-- ── 13. Triggers ──────────────────────────────────────────────────────────────

CREATE TRIGGER acc_journeys_updated_at
  BEFORE UPDATE ON accessibility_critical_journeys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
