-- ============================================================
-- 025_monitor_pages.sql — Per-page tracking for monitors
-- ============================================================
-- Adds monitor_pages table so each monitor can track an
-- explicit list of pages (homepage, pinned set, or discovered).
-- The monitors.scope JSONB field stores the mode/config; this
-- table stores the live page list with per-page score state.
-- ============================================================

-- ─── monitor_pages ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS monitor_pages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id        UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  url               TEXT NOT NULL,
  -- 'root': the monitor's root URL (always present); 'pinned': user-added;
  -- 'discovered': found via sitemap/crawl
  page_type         TEXT NOT NULL DEFAULT 'root'
    CHECK (page_type IN ('root', 'pinned', 'discovered')),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  -- Source that surfaced this page
  discovery_source  TEXT CHECK (discovery_source IN ('manual', 'sitemap', 'crawl', 'initial')),
  depth             INTEGER NOT NULL DEFAULT 0,
  -- Cached scores from the last successful check
  last_scores       JSONB,
  last_analysis_id  UUID REFERENCES analyses(id) ON DELETE SET NULL,
  last_run_id       UUID REFERENCES monitor_runs(id) ON DELETE SET NULL,
  last_checked_at   TIMESTAMPTZ,
  -- Ordering hint so UI shows pages in a stable order
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (monitor_id, url)
);

CREATE INDEX IF NOT EXISTS idx_monitor_pages_monitor_id
  ON monitor_pages(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monitor_pages_active
  ON monitor_pages(monitor_id, is_active) WHERE is_active = TRUE;

CREATE TRIGGER monitor_pages_updated_at
  BEFORE UPDATE ON monitor_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Extend monitors with page_mode column ────────────────────────────────────
-- page_mode drives which pages are checked each run:
--   homepage     — root URL only (default, backward-compatible)
--   pinned       — explicit list in monitor_pages (page_type IN ('root','pinned'))
--   sitemap      — pages discovered from sitemap.xml + robots.txt
--   custom       — user manages the list entirely via the API

ALTER TABLE monitors
  ADD COLUMN IF NOT EXISTS page_mode TEXT NOT NULL DEFAULT 'homepage'
    CHECK (page_mode IN ('homepage', 'pinned', 'sitemap', 'custom')),
  ADD COLUMN IF NOT EXISTS max_pages  INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pages_last_discovered_at TIMESTAMPTZ;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE monitor_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monitor_pages_select_own" ON monitor_pages
  FOR SELECT USING (
    monitor_id IN (SELECT id FROM monitors WHERE user_id = auth.uid())
  );

CREATE POLICY "monitor_pages_insert_own" ON monitor_pages
  FOR INSERT WITH CHECK (
    monitor_id IN (SELECT id FROM monitors WHERE user_id = auth.uid())
  );

CREATE POLICY "monitor_pages_update_own" ON monitor_pages
  FOR UPDATE USING (
    monitor_id IN (SELECT id FROM monitors WHERE user_id = auth.uid())
  );

CREATE POLICY "monitor_pages_delete_own" ON monitor_pages
  FOR DELETE USING (
    monitor_id IN (SELECT id FROM monitors WHERE user_id = auth.uid())
  );

CREATE POLICY "monitor_pages_service_role" ON monitor_pages
  FOR ALL USING (auth.role() = 'service_role');

-- ─── Seed root page for existing monitors ─────────────────────────────────────
-- Back-fill one root page row per existing monitor so new code can always
-- query monitor_pages without needing special-case handling of old monitors.

INSERT INTO monitor_pages (monitor_id, url, page_type, discovery_source, is_active, sort_order)
SELECT id, url, 'root', 'initial', TRUE, 0
FROM monitors
ON CONFLICT (monitor_id, url) DO NOTHING;
