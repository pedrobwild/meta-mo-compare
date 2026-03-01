
-- =============================================
-- PHASE 1B: CONNECTORS & SYNC
-- =============================================

CREATE TABLE public.connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'meta',
  status text NOT NULL DEFAULT 'active',
  config_json jsonb DEFAULT '{}',
  last_successful_sync timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.connectors ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_connectors_workspace ON public.connectors(workspace_id);

CREATE POLICY "Members can view connectors" ON public.connectors
  FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admin+ can manage connectors" ON public.connectors
  FOR ALL TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TABLE public.ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'meta',
  external_account_id text NOT NULL,
  name text,
  currency text DEFAULT 'BRL',
  timezone text DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ad_accounts_workspace ON public.ad_accounts(workspace_id);
CREATE UNIQUE INDEX idx_ad_accounts_unique ON public.ad_accounts(workspace_id, provider, external_account_id);

CREATE POLICY "Members can view ad_accounts" ON public.ad_accounts
  FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Admin+ can manage ad_accounts" ON public.ad_accounts
  FOR ALL TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE TABLE public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'meta',
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  records_fetched integer DEFAULT 0,
  records_upserted integer DEFAULT 0,
  error text,
  params_json jsonb DEFAULT '{}'
);
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sync_runs_workspace ON public.sync_runs(workspace_id);

CREATE POLICY "Members can view sync_runs" ON public.sync_runs
  FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Service can manage sync_runs" ON public.sync_runs
  FOR ALL TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
