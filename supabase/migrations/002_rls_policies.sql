-- Row Level Security
ALTER TABLE analyses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- analyses
CREATE POLICY "analyses_select_own" ON analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "analyses_insert_own" ON analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "analyses_update_own" ON analyses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "analyses_service_role" ON analyses FOR ALL USING (auth.role() = 'service_role');

-- user_settings
CREATE POLICY "user_settings_select_own" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_settings_update_own" ON user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_settings_service_role" ON user_settings FOR ALL USING (auth.role() = 'service_role');

-- subscriptions
CREATE POLICY "subscriptions_select_own" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "subscriptions_service_role" ON subscriptions FOR ALL USING (auth.role() = 'service_role');
