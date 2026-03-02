
-- Create anomaly_events table
CREATE TABLE public.anomaly_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  entity_type text NOT NULL DEFAULT 'campaign',
  entity_id text NOT NULL DEFAULT '',
  entity_name text,
  metric text NOT NULL,
  value_current numeric NOT NULL DEFAULT 0,
  value_expected numeric NOT NULL DEFAULT 0,
  deviation_pct numeric NOT NULL DEFAULT 0,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- RLS
ALTER TABLE public.anomaly_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view anomaly_events"
  ON public.anomaly_events FOR SELECT
  TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can manage anomaly_events"
  ON public.anomaly_events FOR ALL
  TO authenticated
  USING (is_workspace_member(auth.uid(), workspace_id));

-- Enable realtime for anomaly_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.anomaly_events;
