-- Read tracking for unread message badge
CREATE TABLE IF NOT EXISTS fix_request_read_states (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fix_request_id  UUID NOT NULL REFERENCES fix_requests(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(fix_request_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_frrs_fix_request ON fix_request_read_states(fix_request_id);
CREATE INDEX IF NOT EXISTS idx_frrs_user ON fix_request_read_states(user_id);
ALTER TABLE fix_request_read_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "frrs_select_own" ON fix_request_read_states FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "frrs_insert_own" ON fix_request_read_states FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "frrs_update_own" ON fix_request_read_states FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "frrs_service" ON fix_request_read_states FOR ALL USING (auth.role() = 'service_role');
