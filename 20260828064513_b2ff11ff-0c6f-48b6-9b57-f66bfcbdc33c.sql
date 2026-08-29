CREATE TABLE public.business_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Business Agent',
  status text NOT NULL DEFAULT 'active',
  objective text,
  last_error text,
  last_activity_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_agents_status_check CHECK (status IN ('active','paused'))
);

CREATE TABLE public.agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.business_agents(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  task_type text NOT NULL DEFAULT 'general',
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  requires_approval boolean NOT NULL DEFAULT false,
  error_message text,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_tasks_status_check CHECK (status IN ('pending','running','completed','failed','cancelled','awaiting_approval')),
  CONSTRAINT agent_tasks_priority_check CHECK (priority IN ('low','medium','high','urgent'))
);

CREATE TABLE public.agent_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES public.business_agents(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.agent_tasks(id) ON DELETE SET NULL,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'info',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_business_agents_user ON public.business_agents(user_id);
CREATE INDEX idx_agent_tasks_agent_created ON public.agent_tasks(agent_id, created_at DESC);
CREATE INDEX idx_agent_tasks_user_status ON public.agent_tasks(user_id, status);
CREATE INDEX idx_agent_activity_agent_created ON public.agent_activity_log(agent_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_agents TO authenticated;
GRANT ALL ON public.business_agents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_tasks TO authenticated;
GRANT ALL ON public.agent_tasks TO service_role;
GRANT SELECT, INSERT ON public.agent_activity_log TO authenticated;
GRANT ALL ON public.agent_activity_log TO service_role;

ALTER TABLE public.business_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners select agents" ON public.business_agents FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Owners insert agents" ON public.business_agents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.user_id = auth.uid()));
CREATE POLICY "Owners update agents" ON public.business_agents FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners delete agents" ON public.business_agents FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners select agent tasks" ON public.agent_tasks FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Owners insert agent tasks" ON public.agent_tasks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.user_id = auth.uid()));
CREATE POLICY "Owners update agent tasks" ON public.agent_tasks FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Owners delete agent tasks" ON public.agent_tasks FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners select agent activity" ON public.agent_activity_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Owners insert agent activity" ON public.agent_activity_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.user_id = auth.uid()));

CREATE TRIGGER set_updated_at_business_agents BEFORE UPDATE ON public.business_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER set_updated_at_agent_tasks BEFORE UPDATE ON public.agent_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();