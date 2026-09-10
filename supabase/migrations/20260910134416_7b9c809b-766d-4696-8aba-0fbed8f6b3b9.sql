ALTER TABLE public.agent_tasks
  ADD COLUMN IF NOT EXISTS execution_key text,
  ADD COLUMN IF NOT EXISTS assigned_agent_type text,
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.agent_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_reason text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_agent_tasks_parent ON public.agent_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_assigned_type ON public.agent_tasks(business_id, assigned_agent_type);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_tasks_user_execution_key
  ON public.agent_tasks(user_id, execution_key)
  WHERE execution_key IS NOT NULL;

ALTER TABLE public.agent_tasks
  DROP CONSTRAINT IF EXISTS agent_tasks_assigned_agent_type_check;

ALTER TABLE public.agent_tasks
  ADD CONSTRAINT agent_tasks_assigned_agent_type_check CHECK (
    assigned_agent_type IS NULL OR assigned_agent_type IN (
      'business','market_research','competitor','business_strategy','marketing','sales','analytics','optimization'
    )
  );