
-- facts_meta_insights_daily: analytical fact table with breakdowns
CREATE TABLE IF NOT EXISTS public.facts_meta_insights_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  date date NOT NULL,
  level text NOT NULL DEFAULT 'ad',
  campaign_id text,
  adset_id text,
  ad_id text,
  creative_id text,
  -- breakdowns
  placement text,
  device_platform text,
  publisher_platform text,
  age text,
  gender text,
  country text,
  -- metrics
  spend numeric NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  reach bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  inline_link_clicks bigint NOT NULL DEFAULT 0,
  landing_page_views bigint NOT NULL DEFAULT 0,
  results_leads bigint NOT NULL DEFAULT 0,
  purchases bigint NOT NULL DEFAULT 0,
  purchase_value numeric NOT NULL DEFAULT 0,
  add_to_cart bigint NOT NULL DEFAULT 0,
  initiate_checkout bigint NOT NULL DEFAULT 0,
  -- derived (cached, can be recomputed)
  ctr_link numeric,
  cpc_link numeric,
  cpm numeric,
  frequency numeric,
  cpa_lead numeric,
  roas numeric,
  -- meta
  attribution_setting text,
  actions_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint for upsert
CREATE UNIQUE INDEX IF NOT EXISTS facts_insights_unique_idx ON public.facts_meta_insights_daily (
  workspace_id, ad_account_id, date, level,
  COALESCE(campaign_id, ''), COALESCE(adset_id, ''), COALESCE(ad_id, ''),
  COALESCE(placement, ''), COALESCE(device_platform, ''), COALESCE(publisher_platform, ''),
  COALESCE(age, ''), COALESCE(gender, ''), COALESCE(country, ''), COALESCE(attribution_setting, '')
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS facts_insights_ws_date_idx ON public.facts_meta_insights_daily (workspace_id, date);
CREATE INDEX IF NOT EXISTS facts_insights_campaign_idx ON public.facts_meta_insights_daily (workspace_id, campaign_id);

-- RLS
ALTER TABLE public.facts_meta_insights_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view facts" ON public.facts_meta_insights_daily
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Service can manage facts" ON public.facts_meta_insights_daily
  FOR ALL USING (is_workspace_member(auth.uid(), workspace_id));
