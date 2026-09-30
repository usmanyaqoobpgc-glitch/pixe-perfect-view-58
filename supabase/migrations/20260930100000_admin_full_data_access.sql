-- Admin-only read access to every user's data (users keep access to their own rows only).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'businesses','business_plans','milestones','tasks','leads','customers',
    'revenue_records','marketing_content','website_drafts','notifications',
    'ai_agent_runs','business_agents','agent_tasks','agent_activity_log'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS "admin_select_all_%1$s" ON public.%1$I', t);
      EXECUTE format('CREATE POLICY "admin_select_all_%1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.is_admin())', t);
    END IF;
  END LOOP;
END $$;
