-- 1. Update any existing NULLs to empty strings FIRST
UPDATE public.facts_meta_insights_daily SET
  campaign_id = COALESCE(campaign_id, ''),
  adset_id = COALESCE(adset_id, ''),
  ad_id = COALESCE(ad_id, ''),
  placement = COALESCE(placement, ''),
  device_platform = COALESCE(device_platform, ''),
  publisher_platform = COALESCE(publisher_platform, ''),
  age = COALESCE(age, ''),
  gender = COALESCE(gender, ''),
  country = COALESCE(country, ''),
  attribution_setting = COALESCE(attribution_setting, '')
WHERE campaign_id IS NULL OR adset_id IS NULL OR ad_id IS NULL
   OR placement IS NULL OR device_platform IS NULL OR publisher_platform IS NULL
   OR age IS NULL OR gender IS NULL OR country IS NULL OR attribution_setting IS NULL;

-- 2. Make breakdown columns NOT NULL with default ''
ALTER TABLE public.facts_meta_insights_daily
  ALTER COLUMN campaign_id SET DEFAULT '',
  ALTER COLUMN campaign_id SET NOT NULL,
  ALTER COLUMN adset_id SET DEFAULT '',
  ALTER COLUMN adset_id SET NOT NULL,
  ALTER COLUMN ad_id SET DEFAULT '',
  ALTER COLUMN ad_id SET NOT NULL,
  ALTER COLUMN placement SET DEFAULT '',
  ALTER COLUMN placement SET NOT NULL,
  ALTER COLUMN device_platform SET DEFAULT '',
  ALTER COLUMN device_platform SET NOT NULL,
  ALTER COLUMN publisher_platform SET DEFAULT '',
  ALTER COLUMN publisher_platform SET NOT NULL,
  ALTER COLUMN age SET DEFAULT '',
  ALTER COLUMN age SET NOT NULL,
  ALTER COLUMN gender SET DEFAULT '',
  ALTER COLUMN gender SET NOT NULL,
  ALTER COLUMN country SET DEFAULT '',
  ALTER COLUMN country SET NOT NULL,
  ALTER COLUMN attribution_setting SET DEFAULT '',
  ALTER COLUMN attribution_setting SET NOT NULL;

-- 3. Drop the old COALESCE-based unique index
DROP INDEX IF EXISTS public.facts_insights_unique_idx;

-- 4. Create a proper UNIQUE constraint
ALTER TABLE public.facts_meta_insights_daily
  ADD CONSTRAINT facts_insights_unique_key
  UNIQUE (workspace_id, ad_account_id, date, level, campaign_id, adset_id, ad_id,
          placement, device_platform, publisher_platform, age, gender, country, attribution_setting);