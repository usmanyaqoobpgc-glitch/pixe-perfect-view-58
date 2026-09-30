DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['businesses','business_plans','business_agents','agent_tasks','agent_activity_log','ai_agent_runs','customers','leads','marketing_content','milestones','revenue_records','tasks','website_drafts','notifications'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins read all %1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "Admins read all %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.is_admin())', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.admin_get_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Permission denied: admin role required'; END IF;
  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM profiles),
    'businesses', (SELECT count(*) FROM businesses),
    'leads', (SELECT count(*) FROM leads),
    'customers', (SELECT count(*) FROM customers),
    'tasks', (SELECT count(*) FROM tasks),
    'agent_tasks', (SELECT count(*) FROM agent_tasks),
    'agent_runs', (SELECT count(*) FROM ai_agent_runs),
    'revenue', (SELECT COALESCE(sum(amount),0) FROM revenue_records WHERE type='revenue'),
    'expenses', (SELECT COALESCE(sum(amount),0) FROM revenue_records WHERE type<>'revenue')
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_get_user_data(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Permission denied: admin role required'; END IF;
  WITH b AS (SELECT id FROM businesses WHERE user_id = p_user_id)
  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(p) - 'preferences' FROM profiles p WHERE p.id = p_user_id),
    'businesses', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (SELECT id,name,idea,status,workspace_type,budget,revenue_target,currency,created_at FROM businesses WHERE user_id=p_user_id) x),'[]'),
    'leads', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,business_id,name,email,phone,source,status,estimated_value,created_at FROM leads WHERE business_id IN (SELECT id FROM b) ORDER BY created_at DESC LIMIT 200) x),'[]'),
    'customers', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,business_id,name,email,phone,status,lifetime_value,created_at FROM customers WHERE business_id IN (SELECT id FROM b) ORDER BY created_at DESC LIMIT 200) x),'[]'),
    'tasks', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,business_id,title,category,priority,status,due_date,created_at FROM tasks WHERE business_id IN (SELECT id FROM b) ORDER BY created_at DESC LIMIT 200) x),'[]'),
    'agent_tasks', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,business_id,title,task_type,assigned_agent_type,priority,status,created_at,completed_at FROM agent_tasks WHERE user_id=p_user_id ORDER BY created_at DESC LIMIT 200) x),'[]'),
    'agent_runs', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,business_id,agent_type,status,created_at,completed_at FROM ai_agent_runs WHERE user_id=p_user_id ORDER BY created_at DESC LIMIT 200) x),'[]'),
    'revenue', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,business_id,type,amount,description,category,record_date,is_estimate FROM revenue_records WHERE business_id IN (SELECT id FROM b) ORDER BY record_date DESC LIMIT 200) x),'[]'),
    'marketing_content', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,business_id,channel,content_type,title,status,scheduled_date,created_at FROM marketing_content WHERE business_id IN (SELECT id FROM b) ORDER BY created_at DESC LIMIT 200) x),'[]'),
    'website_drafts', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT id,business_id,version,is_published,published_url,updated_at FROM website_drafts WHERE business_id IN (SELECT id FROM b) ORDER BY updated_at DESC LIMIT 50) x),'[]')
  ) INTO r;
  INSERT INTO audit_logs (user_id, event_type, event_description, metadata)
  VALUES (auth.uid(), 'admin_view_user_data', 'Admin viewed a user''s saved data', jsonb_build_object('target_user_id', p_user_id));
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.admin_get_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_user_data(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_user_data(uuid) TO authenticated;