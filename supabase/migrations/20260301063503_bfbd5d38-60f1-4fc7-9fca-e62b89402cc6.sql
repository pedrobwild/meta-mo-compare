
-- =============================================
-- PHASE 1C: DIMENSION TABLES (ENTITIES)
-- =============================================

CREATE TABLE public.meta_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  campaign_id text NOT NULL,
  name text NOT NULL,
  objective text,
  status text,
  effective_status text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, ad_account_id, campaign_id)
);
ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_meta_campaigns_ws ON public.meta_campaigns(workspace_id, ad_account_id);

CREATE POLICY "Members can view" ON public.meta_campaigns
  FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TABLE public.meta_adsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  adset_id text NOT NULL,
  campaign_id text NOT NULL,
  name text NOT NULL,
  status text,
  effective_status text,
  optimization_goal text,
  billing_event text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, ad_account_id, adset_id)
);
ALTER TABLE public.meta_adsets ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_meta_adsets_ws ON public.meta_adsets(workspace_id, ad_account_id);

CREATE POLICY "Members can view" ON public.meta_adsets
  FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TABLE public.meta_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  ad_id text NOT NULL,
  adset_id text NOT NULL,
  campaign_id text NOT NULL,
  name text NOT NULL,
  status text,
  effective_status text,
  creative_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, ad_account_id, ad_id)
);
ALTER TABLE public.meta_ads ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_meta_ads_ws ON public.meta_ads(workspace_id, ad_account_id);

CREATE POLICY "Members can view" ON public.meta_ads
  FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TABLE public.meta_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  creative_id text NOT NULL,
  name text,
  asset_spec_json jsonb,
  thumbnail_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, ad_account_id, creative_id)
);
ALTER TABLE public.meta_creatives ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_meta_creatives_ws ON public.meta_creatives(workspace_id, ad_account_id);

CREATE POLICY "Members can view" ON public.meta_creatives
  FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
