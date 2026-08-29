-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin','support')),
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  mfa_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "insert_own_profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- businesses
-- ============================================================
CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled Business',
  idea text NOT NULL,
  budget numeric(12,2) NOT NULL DEFAULT 0,
  country text,
  target_customer text,
  skills text[],
  available_time_hours_per_week integer,
  business_model text,
  revenue_target numeric(12,2) NOT NULL DEFAULT 0,
  target_deadline date,
  marketing_channels text[],
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','paused','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_businesses" ON public.businesses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_businesses" ON public.businesses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_businesses" ON public.businesses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_businesses" ON public.businesses FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON public.businesses(user_id);

-- ============================================================
-- business_plans
-- ============================================================
CREATE TABLE IF NOT EXISTS public.business_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  section_key text NOT NULL CHECK (section_key IN (
    'idea_analysis','target_audience','competitor_research','market_positioning',
    'offer_creation','pricing_strategy','brand_names','roadmap','milestones',
    'daily_tasks','marketing_strategy','social_content','landing_page',
    'lead_generation','customer_templates','revenue_targets','kpis',
    'weekly_analysis','ai_recommendations'
  )),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, section_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_plans TO authenticated;
GRANT ALL ON public.business_plans TO service_role;
ALTER TABLE public.business_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_plans" ON public.business_plans FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_plans.business_id AND b.user_id = auth.uid()));
CREATE POLICY "insert_own_plans" ON public.business_plans FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_plans.business_id AND b.user_id = auth.uid()));
CREATE POLICY "update_own_plans" ON public.business_plans FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_plans.business_id AND b.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_plans.business_id AND b.user_id = auth.uid()));
CREATE POLICY "delete_own_plans" ON public.business_plans FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_plans.business_id AND b.user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_plans_business_id ON public.business_plans(business_id);

-- ============================================================
-- milestones
-- ============================================================
CREATE TABLE IF NOT EXISTS public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  target_day integer NOT NULL CHECK (target_day IN (30,60,90)),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO authenticated;
GRANT ALL ON public.milestones TO service_role;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_milestones" ON public.milestones FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = milestones.business_id AND b.user_id = auth.uid()));
CREATE POLICY "insert_own_milestones" ON public.milestones FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = milestones.business_id AND b.user_id = auth.uid()));
CREATE POLICY "update_own_milestones" ON public.milestones FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = milestones.business_id AND b.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = milestones.business_id AND b.user_id = auth.uid()));
CREATE POLICY "delete_own_milestones" ON public.milestones FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = milestones.business_id AND b.user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_milestones_business_id ON public.milestones(business_id);

-- ============================================================
-- tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_tasks" ON public.tasks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = tasks.business_id AND b.user_id = auth.uid()));
CREATE POLICY "insert_own_tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = tasks.business_id AND b.user_id = auth.uid()));
CREATE POLICY "update_own_tasks" ON public.tasks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = tasks.business_id AND b.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = tasks.business_id AND b.user_id = auth.uid()));
CREATE POLICY "delete_own_tasks" ON public.tasks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = tasks.business_id AND b.user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_tasks_business_id ON public.tasks(business_id);

-- ============================================================
-- leads
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  source text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','converted','lost')),
  notes text,
  estimated_value numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_leads" ON public.leads FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = leads.business_id AND b.user_id = auth.uid()));
CREATE POLICY "insert_own_leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = leads.business_id AND b.user_id = auth.uid()));
CREATE POLICY "update_own_leads" ON public.leads FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = leads.business_id AND b.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = leads.business_id AND b.user_id = auth.uid()));
CREATE POLICY "delete_own_leads" ON public.leads FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = leads.business_id AND b.user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_leads_business_id ON public.leads(business_id);

-- ============================================================
-- customers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  notes text,
  lifetime_value numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','churned','paused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_customers" ON public.customers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = customers.business_id AND b.user_id = auth.uid()));
CREATE POLICY "insert_own_customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = customers.business_id AND b.user_id = auth.uid()));
CREATE POLICY "update_own_customers" ON public.customers FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = customers.business_id AND b.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = customers.business_id AND b.user_id = auth.uid()));
CREATE POLICY "delete_own_customers" ON public.customers FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = customers.business_id AND b.user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_customers_business_id ON public.customers(business_id);

-- ============================================================
-- revenue_records
-- ============================================================
CREATE TABLE IF NOT EXISTS public.revenue_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('revenue','expense')),
  amount numeric(12,2) NOT NULL,
  description text NOT NULL,
  category text,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  is_estimate boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_records TO authenticated;
GRANT ALL ON public.revenue_records TO service_role;
ALTER TABLE public.revenue_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_revenue" ON public.revenue_records FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = revenue_records.business_id AND b.user_id = auth.uid()));
CREATE POLICY "insert_own_revenue" ON public.revenue_records FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = revenue_records.business_id AND b.user_id = auth.uid()));
CREATE POLICY "update_own_revenue" ON public.revenue_records FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = revenue_records.business_id AND b.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = revenue_records.business_id AND b.user_id = auth.uid()));
CREATE POLICY "delete_own_revenue" ON public.revenue_records FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = revenue_records.business_id AND b.user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_revenue_business_id ON public.revenue_records(business_id);

-- ============================================================
-- marketing_content
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  channel text NOT NULL,
  content_type text NOT NULL,
  title text NOT NULL,
  body text,
  status text NOT NULL DEFAULT 'idea' CHECK (status IN ('idea','drafted','scheduled','published')),
  scheduled_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_content TO authenticated;
GRANT ALL ON public.marketing_content TO service_role;
ALTER TABLE public.marketing_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_marketing" ON public.marketing_content FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = marketing_content.business_id AND b.user_id = auth.uid()));
CREATE POLICY "insert_own_marketing" ON public.marketing_content FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = marketing_content.business_id AND b.user_id = auth.uid()));
CREATE POLICY "update_own_marketing" ON public.marketing_content FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = marketing_content.business_id AND b.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = marketing_content.business_id AND b.user_id = auth.uid()));
CREATE POLICY "delete_own_marketing" ON public.marketing_content FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = marketing_content.business_id AND b.user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_marketing_business_id ON public.marketing_content(business_id);

-- ============================================================
-- website_drafts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.website_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  published_url text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_drafts TO authenticated;
GRANT ALL ON public.website_drafts TO service_role;
ALTER TABLE public.website_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_drafts" ON public.website_drafts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = website_drafts.business_id AND b.user_id = auth.uid()));
CREATE POLICY "insert_own_drafts" ON public.website_drafts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = website_drafts.business_id AND b.user_id = auth.uid()));
CREATE POLICY "update_own_drafts" ON public.website_drafts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = website_drafts.business_id AND b.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = website_drafts.business_id AND b.user_id = auth.uid()));
CREATE POLICY "delete_own_drafts" ON public.website_drafts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = website_drafts.business_id AND b.user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_drafts_business_id ON public.website_drafts(business_id);

-- ============================================================
-- notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','error','ai')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- ============================================================
-- audit_logs (insert + read own only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_description text NOT NULL,
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================
-- security_events (insert + read own only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'login_success','login_failed','logout','password_change','mfa_enable','mfa_disable',
    'mfa_enrolled','mfa_removed','mfa_challenge_failed',
    'password_reset_request','password_reset_complete','session_revoke',
    'account_recovery','permission_change','api_key_change','billing_change',
    'admin_action','data_export','security_setting_change','suspicious_login'
  )),
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_security_events" ON public.security_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_security_events" ON public.security_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at DESC);

-- ============================================================
-- ai_agent_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type text NOT NULL CHECK (agent_type IN (
    'market_research','competitor','business_strategy','marketing','sales',
    'analytics','optimization'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed')),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasoning text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_agent_runs TO authenticated;
GRANT ALL ON public.ai_agent_runs TO service_role;
ALTER TABLE public.ai_agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_own_agent_runs" ON public.ai_agent_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_agent_runs" ON public.ai_agent_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_agent_runs" ON public.ai_agent_runs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_agent_runs" ON public.ai_agent_runs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id ON public.ai_agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_business_id ON public.ai_agent_runs(business_id);

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_businesses BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_business_plans BEFORE UPDATE ON public.business_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_leads BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_customers BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_website_drafts BEFORE UPDATE ON public.website_drafts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RBAC helpers
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') $$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_support_or_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','support')) $$;
REVOKE EXECUTE ON FUNCTION public.is_support_or_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_support_or_admin() TO authenticated;

CREATE POLICY "select_all_profiles_staff" ON public.profiles FOR SELECT TO authenticated USING (public.is_support_or_admin());
CREATE POLICY "select_all_audit_logs_admin" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "select_all_security_events_admin" ON public.security_events FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.prevent_unauthorized_role_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: only admins can change user roles';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.prevent_unauthorized_role_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER prevent_role_change
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_unauthorized_role_change();

CREATE OR REPLACE FUNCTION public.staff_list_users()
RETURNS TABLE (
  id uuid, email text, full_name text, role text,
  mfa_enabled boolean, created_at timestamptz, business_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_support_or_admin() THEN
    RAISE EXCEPTION 'Permission denied: staff role required';
  END IF;
  RETURN QUERY
    SELECT p.id, p.email, p.full_name, p.role, p.mfa_enabled, p.created_at,
      (SELECT count(*) FROM public.businesses b WHERE b.user_id = p.id) AS business_count
    FROM public.profiles p
    ORDER BY p.created_at DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.staff_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_list_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_user_role(p_user_id uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;
  IF p_role NOT IN ('user','support','admin') THEN
    RAISE EXCEPTION 'Invalid role: must be user, support, or admin';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;

  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;

  INSERT INTO public.audit_logs (user_id, event_type, event_description, metadata)
  VALUES (auth.uid(), 'permission_change', 'Admin updated user role to ''' || p_role || '''',
    jsonb_build_object('target_user_id', p_user_id, 'new_role', p_role));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_audit_logs(p_limit integer DEFAULT 100)
RETURNS TABLE (
  id uuid, user_id uuid, event_type text, event_description text,
  ip_address text, user_agent text, metadata jsonb, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;
  RETURN QUERY
    SELECT a.id, a.user_id, a.event_type, a.event_description,
      a.ip_address, a.user_agent, a.metadata, a.created_at
    FROM public.audit_logs a
    ORDER BY a.created_at DESC
    LIMIT p_limit;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_get_audit_logs(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_audit_logs(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.log_failed_login(p_email text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = lower(p_email) LIMIT 1;
  INSERT INTO public.security_events (user_id, event_type, metadata)
  VALUES (v_user_id, 'login_failed', jsonb_build_object('email', p_email, 'reason', COALESCE(p_reason, 'invalid_credentials')));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.log_failed_login(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_failed_login(text, text) TO anon, authenticated;