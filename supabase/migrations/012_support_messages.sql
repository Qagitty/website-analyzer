CREATE TABLE support_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_messages_created_at ON support_messages(created_at DESC);
CREATE INDEX idx_support_messages_read ON support_messages(read);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (admin access only, no user self-access)
CREATE POLICY "support_messages_service_role" ON support_messages
  FOR ALL USING (auth.role() = 'service_role');
