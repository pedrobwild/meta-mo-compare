-- Create meta_lead_forms table for form metadata
CREATE TABLE public.meta_lead_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  form_id text NOT NULL,
  name text,
  status text,
  page_id text,
  created_time timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, form_id)
);

ALTER TABLE public.meta_lead_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view lead_forms"
  ON public.meta_lead_forms FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can manage lead_forms"
  ON public.meta_lead_forms FOR ALL TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

-- Create meta_leads table for individual lead data
CREATE TABLE public.meta_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  lead_id text NOT NULL,
  form_id text NOT NULL,
  campaign_id text,
  adset_id text,
  ad_id text,
  created_time timestamptz NOT NULL,
  field_data jsonb NOT NULL DEFAULT '{}',
  -- Extracted common fields for easy querying
  lead_name text,
  lead_email text,
  lead_phone text,
  is_organic boolean DEFAULT false,
  platform text DEFAULT 'facebook',
  raw_json jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, lead_id)
);

ALTER TABLE public.meta_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view leads"
  ON public.meta_leads FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can manage leads"
  ON public.meta_leads FOR ALL TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

-- Indexes for performance
CREATE INDEX idx_meta_leads_workspace_date ON public.meta_leads (workspace_id, created_time DESC);
CREATE INDEX idx_meta_leads_campaign ON public.meta_leads (workspace_id, campaign_id);
CREATE INDEX idx_meta_leads_form ON public.meta_leads (workspace_id, form_id);

-- Enable realtime for leads
ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_leads;