-- Seed data for local development
-- Run after migrations: supabase db reset

-- Note: auth.users is managed by Supabase Auth.
-- Use the Supabase dashboard or sign up flow to create test users.
-- user_settings and subscriptions are created automatically via the handle_new_user trigger.

-- To manually insert a test analysis (replace USER_ID with actual UUID):
/*
INSERT INTO analyses (user_id, url, status, lighthouse_scores, console_errors, accessibility_issues, ai_summary, completed_at)
VALUES (
  'USER_ID',
  'https://example.com',
  'completed',
  '{"performance": 72, "accessibility": 85, "bestPractices": 90, "seo": 78, "lcp": 3200, "fid": 120, "cls": 0.15, "ttfb": 450}'::jsonb,
  '[{"message": "Failed to load resource", "type": "error", "source": "https://example.com/app.js", "timestamp": 1700000000000}]'::jsonb,
  '[{"id": "color-contrast", "impact": "serious", "description": "Elements must have sufficient color contrast", "nodes": ["h1.title"], "wcagCriteria": ["wcag2aa", "wcag143"]}]'::jsonb,
  'The website has moderate performance with several areas for improvement. The largest issue is slow LCP at 3.2s. Fixing image optimization could improve performance by 20-30%.',
  NOW()
);
*/
