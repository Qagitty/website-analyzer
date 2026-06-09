-- ============================================================
-- 015_email_exists_function.sql
-- Replaces the admin.listUsers() pattern in /api/auth/check-email
-- with an indexed point-lookup that scales to any user count.
--
-- SECURITY DEFINER runs as the function owner (postgres), which
-- has access to auth.users. The anon/authenticated roles cannot
-- query auth.users directly — this function is the controlled gate.
-- ============================================================

CREATE OR REPLACE FUNCTION email_exists(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE lower(email) = lower(p_email)
  );
$$;

-- Restrict execution to the service_role only.
-- The route calls this via the service-role client, so this is correct.
REVOKE EXECUTE ON FUNCTION email_exists(TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION email_exists(TEXT) TO service_role;
