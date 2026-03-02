
-- funnel_leads: individual lead tracking
CREATE TABLE public.funnel_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id text NOT NULL,
  name text,
  email text,
  phone text,
  created_at timestamptz DEFAULT now(),
  source text DEFAULT 'meta',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  campaign_id text,
  adset_id text,
  ad_id text,
  stage text DEFAULT 'lead',
  stage_updated_at timestamptz DEFAULT now(),
  contact_attempts int DEFAULT 0,
  first_contact_at timestamptz,
  time_to_first_contact_minutes int,
  qualification_notes text,
  lost_reason text,
  deal_value numeric DEFAULT 0,
  is_mql boolean DEFAULT false,
  is_sql boolean DEFAULT false,
  is_valid_contact boolean DEFAULT true,
  UNIQUE(workspace_id, lead_id)
);

ALTER TABLE public.funnel_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view funnel_leads" ON public.funnel_leads
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can insert funnel_leads" ON public.funnel_leads
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can update funnel_leads" ON public.funnel_leads
  FOR UPDATE TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

-- funnel_stage_history: track stage changes
CREATE TABLE public.funnel_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.funnel_leads(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  changed_at timestamptz DEFAULT now(),
  changed_by uuid,
  notes text,
  time_in_previous_stage_hours numeric DEFAULT 0
);

ALTER TABLE public.funnel_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view funnel_stage_history" ON public.funnel_stage_history
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can insert funnel_stage_history" ON public.funnel_stage_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

-- funnel_daily_snapshot: daily aggregates
CREATE TABLE public.funnel_daily_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  date date NOT NULL,
  source text DEFAULT 'all',
  campaign_id text,
  total_leads int DEFAULT 0,
  contacted int DEFAULT 0,
  mql_count int DEFAULT 0,
  sql_count int DEFAULT 0,
  scheduled int DEFAULT 0,
  closed_won int DEFAULT 0,
  closed_lost int DEFAULT 0,
  contact_rate_pct numeric DEFAULT 0,
  mql_rate_pct numeric DEFAULT 0,
  sql_rate_pct numeric DEFAULT 0,
  close_rate_pct numeric DEFAULT 0,
  avg_time_to_contact_minutes numeric DEFAULT 0,
  total_revenue numeric DEFAULT 0,
  cost_per_mql numeric DEFAULT 0,
  cost_per_sql numeric DEFAULT 0,
  roas_real numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, date, source, campaign_id)
);

ALTER TABLE public.funnel_daily_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view funnel_daily_snapshot" ON public.funnel_daily_snapshot
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can insert funnel_daily_snapshot" ON public.funnel_daily_snapshot
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));

-- Enable realtime for lead updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.funnel_leads;
