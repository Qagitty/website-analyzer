-- ============================================================
-- 016_team_invite_expiry.sql
-- Adds an expiry timestamp to team invitations.
-- Invites expire 7 days after they are sent; the accept route
-- now rejects tokens whose expiry has passed.
-- ============================================================

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

-- Back-fill: existing pending invites get 7 days from their invited_at.
-- Accepted/rejected rows get NULL (already resolved, expiry irrelevant).
UPDATE team_members
SET invite_expires_at = invited_at + INTERVAL '7 days'
WHERE status = 'pending'
  AND invite_expires_at IS NULL;
