
-- Fix facts_funnel_daily: it was not created due to error, create it now
CREATE TABLE IF NOT EXISTS public.facts_funnel_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  date date NOT NULL,
  mql integer NOT NULL DEFAULT 0,
  sql_count integer NOT NULL DEFAULT 0,
  vendas integer NOT NULL DEFAULT 0,
  receita numeric NOT NULL DEFAULT 0,
  source text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.facts_funnel_daily ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS idx_funnel_daily_unique ON public.facts_funnel_daily(workspace_id, date, source);

CREATE POLICY "Members can view funnel" ON public.facts_funnel_daily
  FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can manage funnel" ON public.facts_funnel_daily
  FOR ALL TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

-- Also create remaining tables that may not have been created
CREATE TABLE IF NOT EXISTS public.targets_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  month_key text NOT NULL,
  spend numeric, leads numeric, receita numeric,
  roas_target numeric, cpa_target numeric, cpm_target numeric, ctr_target numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, month_key)
);
ALTER TABLE public.targets_monthly ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL, enabled boolean NOT NULL DEFAULT true,
  severity text NOT NULL DEFAULT 'medium', scope text NOT NULL DEFAULT 'campaign',
  metric text NOT NULL, operator text NOT NULL DEFAULT 'gt',
  threshold numeric NOT NULL, window_days integer NOT NULL DEFAULT 7,
  min_spend numeric DEFAULT 0, filters_json jsonb DEFAULT '{}',
  notification_channels_json jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  context_json jsonb DEFAULT '{}', status text NOT NULL DEFAULT 'open',
  resolved_at timestamptz
);
ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'open',
  priority integer NOT NULL DEFAULT 50, title text NOT NULL,
  why text, what_to_do text, expected_impact_json jsonb,
  confidence numeric, evidence_json jsonb, entity_level text, entity_id text,
  related_alert_event_id uuid REFERENCES public.alert_events(id) ON DELETE SET NULL
);
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  date date, entity_ref text, note text NOT NULL,
  tags_json jsonb DEFAULT '[]'
);
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, payload_json jsonb DEFAULT '{}'
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
