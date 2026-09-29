ALTER TABLE public.business_agents
  ADD COLUMN IF NOT EXISTS voice text NOT NULL DEFAULT 'professional',
  ADD COLUMN IF NOT EXISTS writing_style text NOT NULL DEFAULT 'clear',
  ADD COLUMN IF NOT EXISTS response_length text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS brand_notes text NOT NULL DEFAULT '';
ALTER TABLE public.business_agents DROP CONSTRAINT IF EXISTS business_agents_response_length_check;
ALTER TABLE public.business_agents ADD CONSTRAINT business_agents_response_length_check CHECK (response_length IN ('short','medium','long'));
ALTER TABLE public.business_agents DROP CONSTRAINT IF EXISTS business_agents_brand_notes_len;
ALTER TABLE public.business_agents ADD CONSTRAINT business_agents_brand_notes_len CHECK (char_length(brand_notes) <= 1000 AND char_length(voice) <= 60 AND char_length(writing_style) <= 60);