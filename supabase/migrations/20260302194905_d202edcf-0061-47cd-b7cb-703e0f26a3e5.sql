
-- data_health_checks table
CREATE TABLE public.data_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  checked_at timestamptz NOT NULL DEFAULT now(),
  check_type text NOT NULL DEFAULT 'sync',
  status text NOT NULL DEFAULT 'healthy',
  entity text NOT NULL DEFAULT '',
  issue_description text NOT NULL DEFAULT '',
  recommendation text NOT NULL DEFAULT '',
  auto_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz
);

ALTER TABLE public.data_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view data_health_checks" ON public.data_health_checks
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can insert data_health_checks" ON public.data_health_checks
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can update data_health_checks" ON public.data_health_checks
  FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can delete data_health_checks" ON public.data_health_checks
  FOR DELETE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE INDEX idx_health_checks_workspace ON public.data_health_checks(workspace_id, checked_at DESC);

-- data_gaps table
CREATE TABLE public.data_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  detected_at timestamptz NOT NULL DEFAULT now(),
  gap_type text NOT NULL DEFAULT 'missing_data',
  campaign_id text,
  campaign_name text,
  date_from date,
  date_to date,
  affected_records integer NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  notes text
);

ALTER TABLE public.data_gaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view data_gaps" ON public.data_gaps
  FOR SELECT TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can insert data_gaps" ON public.data_gaps
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can update data_gaps" ON public.data_gaps
  FOR UPDATE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can delete data_gaps" ON public.data_gaps
  FOR DELETE TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE INDEX idx_data_gaps_workspace ON public.data_gaps(workspace_id, detected_at DESC);
