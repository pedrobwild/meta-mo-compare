
-- Benchmarks reference table
CREATE TABLE public.benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  segment text NOT NULL DEFAULT 'servicos',
  platform text NOT NULL DEFAULT 'meta',
  metric text NOT NULL DEFAULT '',
  value_low numeric NOT NULL DEFAULT 0,
  value_mid numeric NOT NULL DEFAULT 0,
  value_high numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'percent',
  updated_at date NOT NULL DEFAULT CURRENT_DATE,
  source text DEFAULT 'Meta Business Help Center 2026'
);

ALTER TABLE public.benchmarks ENABLE ROW LEVEL SECURITY;

-- Public read (benchmarks are reference data)
CREATE POLICY "Anyone can view benchmarks" ON public.benchmarks FOR SELECT TO authenticated USING (true);

-- Only service role can manage
CREATE POLICY "Service can manage benchmarks" ON public.benchmarks FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_benchmarks_segment_platform ON public.benchmarks(segment, platform);

-- Workspace segment config
CREATE TABLE public.workspace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
  segment text NOT NULL DEFAULT 'servicos',
  ticket_medio numeric DEFAULT 0,
  ciclo_vendas_dias integer DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view settings" ON public.workspace_settings FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can insert settings" ON public.workspace_settings FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can update settings" ON public.workspace_settings FOR UPDATE TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
