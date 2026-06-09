-- ============================================================
-- Sprint 5: Agency Lead Widget
-- ============================================================

-- Add source tracking + lead capture fields to analyses
ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS source     TEXT DEFAULT 'web'
    CHECK (source IN ('web', 'widget', 'api', 'monitor')),
  ADD COLUMN IF NOT EXISTS lead_email TEXT,
  ADD COLUMN IF NOT EXISTS lead_name  TEXT;

CREATE INDEX IF NOT EXISTS idx_analyses_source     ON analyses(source);
CREATE INDEX IF NOT EXISTS idx_analyses_lead_email ON analyses(lead_email) WHERE lead_email IS NOT NULL;

-- Widget key + settings in user_settings
-- widget_key is a public key (safe to embed in HTML) — only allows submitting URLs
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS widget_key      TEXT,
  ADD COLUMN IF NOT EXISTS widget_settings JSONB NOT NULL DEFAULT '{
    "buttonText": "Get a Free Audit",
    "buttonColor": "#6366f1",
    "position": "bottom-right",
    "showEmail": true
  }';

-- Fast lookup by widget key (used in public widget page)
CREATE INDEX IF NOT EXISTS idx_user_settings_widget_key
  ON user_settings(widget_key) WHERE widget_key IS NOT NULL;
