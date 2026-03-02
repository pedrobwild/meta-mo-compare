
CREATE TABLE public.experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  hypothesis text NOT NULL DEFAULT '',
  variable_tested text NOT NULL DEFAULT 'criativo',
  platform text NOT NULL DEFAULT 'meta',
  campaign_id text,
  control_ad_id text,
  variation_ad_id text,
  control_description text NOT NULL DEFAULT '',
  variation_description text NOT NULL DEFAULT '',
  primary_metric text NOT NULL DEFAULT 'cpl',
  success_threshold numeric NOT NULL DEFAULT -20,
  secondary_metrics text[] DEFAULT '{}',
  min_sample_spend numeric NOT NULL DEFAULT 0,
  started_at date,
  ended_at date,
  status text NOT NULL DEFAULT 'planned',
  result_control jsonb DEFAULT '{}',
  result_variation jsonb DEFAULT '{}',
  winner text,
  delta_pct numeric,
  decision text,
  learning text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view experiments" ON public.experiments
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can insert experiments" ON public.experiments
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can update experiments" ON public.experiments
  FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can delete experiments" ON public.experiments
  FOR DELETE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE INDEX idx_experiments_workspace ON public.experiments(workspace_id, created_at DESC);
CREATE INDEX idx_experiments_status ON public.experiments(workspace_id, status);
