CREATE TABLE public.agent_chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.agent_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.agent_chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  mode text NOT NULL DEFAULT 'chat' CHECK (mode IN ('chat','document')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.agent_chat_threads(user_id, business_id, updated_at DESC);
CREATE INDEX ON public.agent_chat_messages(thread_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_chat_threads TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.agent_chat_messages TO authenticated;
GRANT ALL ON public.agent_chat_threads, public.agent_chat_messages TO service_role;
ALTER TABLE public.agent_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own threads" ON public.agent_chat_threads FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_id AND b.user_id = auth.uid()));
CREATE POLICY "admin read threads" ON public.agent_chat_threads FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "own messages" ON public.agent_chat_messages FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.agent_chat_threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
CREATE POLICY "admin read messages" ON public.agent_chat_messages FOR SELECT TO authenticated USING (public.is_admin());