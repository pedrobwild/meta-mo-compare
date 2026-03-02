
-- Create optimization_log table
CREATE TABLE public.optimization_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  decision_type text NOT NULL DEFAULT 'outro',
  entity_type text NOT NULL DEFAULT 'campaign',
  entity_id text NOT NULL DEFAULT '',
  entity_name text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  action_taken text NOT NULL DEFAULT '',
  metric_before jsonb DEFAULT '{}'::jsonb,
  metric_after jsonb DEFAULT NULL,
  expected_impact text DEFAULT '',
  actual_impact text DEFAULT NULL,
  impact_confirmed_at timestamp with time zone DEFAULT NULL,
  status text NOT NULL DEFAULT 'pending',
  tags text[] DEFAULT '{}',
  notes text DEFAULT NULL,
  alert_id uuid DEFAULT NULL REFERENCES public.alert_events(id) ON DELETE SET NULL,
  action_center_id uuid DEFAULT NULL REFERENCES public.recommendations(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.optimization_log ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view optimization_log"
  ON public.optimization_log FOR SELECT
  TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can insert optimization_log"
  ON public.optimization_log FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can update optimization_log"
  ON public.optimization_log FOR UPDATE
  TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can delete optimization_log"
  ON public.optimization_log FOR DELETE
  TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

-- Index for common queries
CREATE INDEX idx_optimization_log_workspace_created ON public.optimization_log (workspace_id, created_at DESC);
CREATE INDEX idx_optimization_log_status ON public.optimization_log (workspace_id, status);
