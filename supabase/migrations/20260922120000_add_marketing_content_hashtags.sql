-- Add an optional hashtags array to marketing_content, so the Social
-- Media Agent's generated content calendar can store hashtag sets
-- alongside each post draft.

ALTER TABLE public.marketing_content
  ADD COLUMN IF NOT EXISTS hashtags text[] NOT NULL DEFAULT '{}';
