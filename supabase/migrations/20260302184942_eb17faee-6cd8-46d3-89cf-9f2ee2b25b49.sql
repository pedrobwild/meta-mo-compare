
CREATE TABLE public.budget_simulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  budget_atual numeric NOT NULL DEFAULT 0,
  budget_simulado numeric NOT NULL DEFAULT 0,
  periodo_dias integer NOT NULL DEFAULT 30,
  objetivo text NOT NULL DEFAULT 'roas',
  valor_objetivo numeric,
  cenarios_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  cenario_recomendado text,
  analise_claude_json jsonb,
  metricas_historicas_json jsonb,
  resultado_real_json jsonb
);

ALTER TABLE public.budget_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can manage budget_simulations"
  ON public.budget_simulations FOR ALL
  USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can view budget_simulations"
  ON public.budget_simulations FOR SELECT
  USING (is_workspace_member(auth.uid(), workspace_id));
