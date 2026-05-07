-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: analyses
-- ============================================
CREATE TABLE analyses (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url                   TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'queued', 'running', 'completed', 'failed')),
  screenshot_url        TEXT,
  lighthouse_scores     JSONB,
  console_errors        JSONB,
  accessibility_issues  JSONB,
  network_requests      JSONB,
  ai_insights           JSONB,
  ai_summary            TEXT,
  error_message         TEXT,
  queue_position        INTEGER,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analyses_user_id    ON analyses(user_id);
CREATE INDEX idx_analyses_status     ON analyses(status);
CREATE INDEX idx_analyses_created_at ON analyses(created_at DESC);

-- ============================================
-- TABLE: user_settings
-- ============================================
CREATE TABLE user_settings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  credits       INTEGER NOT NULL DEFAULT 3,
  credits_used  INTEGER NOT NULL DEFAULT 0,
  notifications JSONB NOT NULL DEFAULT '{"email_on_complete": true, "email_on_fail": true, "weekly_digest": false}',
  preferences   JSONB NOT NULL DEFAULT '{"default_device": "desktop", "timezone": "UTC"}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- ============================================
-- TABLE: subscriptions
-- ============================================
CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  plan                    TEXT NOT NULL DEFAULT 'free'
                            CHECK (plan IN ('free', 'pro', 'agency')),
  status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id         ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
