CREATE TABLE team_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_email  TEXT NOT NULL,
  member_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role          TEXT NOT NULL DEFAULT 'member'
                  CHECK (role IN ('member', 'admin')),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'active', 'rejected')),
  invite_token  TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_team_members_owner    ON team_members(owner_id);
CREATE INDEX idx_team_members_member   ON team_members(member_id);
CREATE INDEX idx_team_members_email    ON team_members(member_email);
CREATE INDEX idx_team_members_token    ON team_members(invite_token);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Owner can see all members on their team
CREATE POLICY "team_owner_all" ON team_members
  FOR ALL USING (auth.uid() = owner_id);

-- Members can see their own invite row
CREATE POLICY "team_member_select" ON team_members
  FOR SELECT USING (auth.uid() = member_id);

-- Service role bypass
CREATE POLICY "team_service_role" ON team_members
  FOR ALL USING (auth.role() = 'service_role');
