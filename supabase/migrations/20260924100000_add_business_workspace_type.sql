-- Add an optional workspace_type to businesses, so the Business Agent and
-- specialist agents can tailor plans, content, and documents to the kind
-- of organization this is (company, school, agency, ecommerce, etc.)
-- instead of always assuming a generic for-profit startup.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS workspace_type text NOT NULL DEFAULT 'startup' CHECK (
    workspace_type IN (
      'startup','company','small_business','agency','ecommerce',
      'school','college','university','creator','marketing_team',
      'software_company','professional_services','other'
    )
  );
