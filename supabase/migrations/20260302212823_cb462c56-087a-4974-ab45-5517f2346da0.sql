
-- Fix campaign_id to be NOT NULL with default '' so upsert works without COALESCE
ALTER TABLE public.audience_demographics ALTER COLUMN campaign_id SET DEFAULT '';
UPDATE public.audience_demographics SET campaign_id = '' WHERE campaign_id IS NULL;
ALTER TABLE public.audience_demographics ALTER COLUMN campaign_id SET NOT NULL;

-- Drop the old functional index and create a plain column index
DROP INDEX IF EXISTS public.idx_audience_demo_upsert;
CREATE UNIQUE INDEX idx_audience_demo_upsert ON public.audience_demographics (workspace_id, date, source, campaign_id, age_range, gender, country, city, region);
