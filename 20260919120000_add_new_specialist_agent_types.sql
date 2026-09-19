-- Widen agent_tasks.assigned_agent_type to allow the newly added specialist
-- agent types (content_writing, seo, social_media, coding, finance,
-- hr_recruitment, customer_support, design, data_excel, project_management,
-- education), in addition to the existing 7 specialists + 'business'.
--
-- No data migration needed: existing rows only ever used the original 8
-- values, all of which remain valid.

ALTER TABLE public.agent_tasks
  DROP CONSTRAINT IF EXISTS agent_tasks_assigned_agent_type_check;

ALTER TABLE public.agent_tasks
  ADD CONSTRAINT agent_tasks_assigned_agent_type_check CHECK (
    assigned_agent_type IS NULL OR assigned_agent_type IN (
      'business',
      'market_research','competitor','business_strategy','marketing','sales','analytics','optimization',
      'content_writing','seo','social_media','coding','finance','hr_recruitment',
      'customer_support','design','data_excel','project_management','education'
    )
  );

-- ai_agent_runs.agent_type has the same restriction (it does not include
-- 'business' since specialist runs are always a specific specialist type).
ALTER TABLE public.ai_agent_runs
  DROP CONSTRAINT IF EXISTS ai_agent_runs_agent_type_check;

ALTER TABLE public.ai_agent_runs
  ADD CONSTRAINT ai_agent_runs_agent_type_check CHECK (
    agent_type IN (
      'market_research','competitor','business_strategy','marketing','sales','analytics','optimization',
      'content_writing','seo','social_media','coding','finance','hr_recruitment',
      'customer_support','design','data_excel','project_management','education'
    )
  );
