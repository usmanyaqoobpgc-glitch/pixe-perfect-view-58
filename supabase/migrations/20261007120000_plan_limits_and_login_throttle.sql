-- 1) Plan limits: Free = 1 business, Pro = 5, Business = unlimited. Admins are exempt.
--    Enforced in the database so no client path can bypass it. Existing businesses are untouched;
--    only NEW inserts are checked. A plan only counts while its subscription is active/trialing.
CREATE OR REPLACE FUNCTION public.enforce_business_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_plan text;
  v_limit int;
  v_count int;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = NEW.user_id;
  IF v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO v_plan
  FROM public.subscriptions
  WHERE user_id = NEW.user_id AND status IN ('active', 'trialing');
  v_plan := COALESCE(v_plan, 'free');

  v_limit := CASE v_plan WHEN 'business' THEN NULL WHEN 'pro' THEN 5 ELSE 1 END;
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent inserts for the same user so two parallel requests can't both slip through.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

  SELECT count(*) INTO v_count FROM public.businesses WHERE user_id = NEW.user_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Your % plan allows % business(es). Upgrade your plan on the Billing page to add more.',
      initcap(v_plan), v_limit;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_business_limit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_business_limit ON public.businesses;
CREATE TRIGGER enforce_business_limit
  BEFORE INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_business_limit();

-- 2) log_failed_login is callable without a session (a failed login has no session yet), so it must
--    not be a way to flood the security log: cap length, and throttle per email and overall.
--    It never raises, so a throttled call can't break the login flow.
CREATE INDEX IF NOT EXISTS idx_security_events_type_created
  ON public.security_events (event_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_failed_login(p_email text, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_email text := lower(left(btrim(COALESCE(p_email, '')), 254));
  v_reason text := left(COALESCE(p_reason, 'invalid_credentials'), 200);
  v_recent_for_email int;
  v_recent_total int;
BEGIN
  IF v_email = '' THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_recent_for_email
  FROM public.security_events
  WHERE event_type = 'login_failed'
    AND created_at > now() - interval '1 minute'
    AND metadata->>'email' = v_email;
  IF v_recent_for_email >= 5 THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_recent_total
  FROM public.security_events
  WHERE event_type = 'login_failed'
    AND created_at > now() - interval '1 minute';
  IF v_recent_total >= 60 THEN
    RETURN;
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email LIMIT 1;
  INSERT INTO public.security_events (user_id, event_type, metadata)
  VALUES (v_user_id, 'login_failed', jsonb_build_object('email', v_email, 'reason', v_reason));
END;
$$;
