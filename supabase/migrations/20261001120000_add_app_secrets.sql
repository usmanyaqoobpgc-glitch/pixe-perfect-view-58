-- Server-only key/value store for credentials (e.g. STRIPE_SECRET_KEY).
-- RLS is forced and no policies exist, so only the service role (server functions) can read it.
CREATE TABLE IF NOT EXISTS public.app_secrets (
  name text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_secrets FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_secrets FROM anon, authenticated, public;
GRANT ALL ON public.app_secrets TO service_role;
