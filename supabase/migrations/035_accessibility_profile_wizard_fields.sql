-- ============================================================
-- 035_accessibility_profile_wizard_fields.sql
--
-- Aligns accessibility_profiles with the fields the profile
-- creation wizard actually submits.
--
-- Two gaps this closes:
--   1. site_url / description / jurisdiction_ids / page_urls
--      were collected by the wizard but had no column to land in.
--   2. assessment_page_mode's CHECK predates the wizard and
--      rejects the only two modes the wizard offers
--      ('sitemap', 'crawl').
--
-- NOTE ON COMPLIANCE LANGUAGE:
--   jurisdiction_ids stores which regional profiles a user asked
--   us to assess against. It records scope of assessment only —
--   it is not an assertion of legal applicability or conformance.
-- ============================================================

ALTER TABLE accessibility_profiles
  ADD COLUMN IF NOT EXISTS site_url         TEXT,
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS jurisdiction_ids TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS page_urls        TEXT[] NOT NULL DEFAULT '{}';

-- Widen assessment_page_mode to cover the wizard's modes while
-- retaining the legacy values already present in existing rows.
ALTER TABLE accessibility_profiles
  DROP CONSTRAINT IF EXISTS accessibility_profiles_assessment_page_mode_check;

ALTER TABLE accessibility_profiles
  ADD CONSTRAINT accessibility_profiles_assessment_page_mode_check
  CHECK (assessment_page_mode IN (
    'homepage', 'important', 'all', 'custom',  -- legacy (029/033)
    'sitemap', 'crawl'                         -- wizard modes
  ));

CREATE INDEX IF NOT EXISTS idx_acc_profiles_site_url
  ON accessibility_profiles(site_url);
