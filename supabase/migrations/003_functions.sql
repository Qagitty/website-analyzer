-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER analyses_updated_at      BEFORE UPDATE ON analyses      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create user_settings + subscriptions on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  INSERT INTO public.subscriptions (user_id, plan, status) VALUES (NEW.id, 'free', 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Atomic credit deduction
CREATE OR REPLACE FUNCTION use_credit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE v_credits INTEGER;
BEGIN
  SELECT credits INTO v_credits FROM user_settings WHERE user_id = p_user_id FOR UPDATE;
  IF v_credits <= 0 THEN RETURN FALSE; END IF;
  UPDATE user_settings SET credits = credits - 1, credits_used = credits_used + 1 WHERE user_id = p_user_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Credit refund (for failed analysis creation)
CREATE OR REPLACE FUNCTION refund_credit(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE user_settings
  SET credits = credits + 1, credits_used = GREATEST(credits_used - 1, 0)
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
