
CREATE TABLE public.ad_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_id text NOT NULL,
  ad_name text NOT NULL,
  campaign_id text,
  adset_id text,
  thumbnail_url text,
  creative_type text DEFAULT 'image',
  angle text,
  hook text,
  cta text,
  first_seen_at date,
  status text DEFAULT 'active',
  lifecycle_stage text DEFAULT 'fresh',
  lifecycle_updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, ad_id)
);

ALTER TABLE public.ad_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view ad_creatives" ON public.ad_creatives
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can insert ad_creatives" ON public.ad_creatives
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can update ad_creatives" ON public.ad_creatives
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TABLE public.creative_daily_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_id text NOT NULL,
  date date NOT NULL,
  impressions numeric DEFAULT 0,
  clicks numeric DEFAULT 0,
  spend numeric DEFAULT 0,
  leads numeric DEFAULT 0,
  ctr numeric DEFAULT 0,
  cpc numeric DEFAULT 0,
  cpm numeric DEFAULT 0,
  cpl numeric DEFAULT 0,
  frequency numeric DEFAULT 0,
  reach numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, ad_id, date)
);

ALTER TABLE public.creative_daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view creative_daily_metrics" ON public.creative_daily_metrics
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can insert creative_daily_metrics" ON public.creative_daily_metrics
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can update creative_daily_metrics" ON public.creative_daily_metrics
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_creatives;
