
-- Tabela 1: qualidade do lead por campanha
CREATE TABLE IF NOT EXISTS public.lead_quality (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date                 DATE NOT NULL,
  campaign_key         TEXT NOT NULL,
  adset_key            TEXT,
  ad_key               TEXT,
  leads_total          INT DEFAULT 0,
  leads_atendidos      INT DEFAULT 0,
  leads_qualificados   INT DEFAULT 0,
  visitas_agendadas    INT DEFAULT 0,
  propostas_enviadas   INT DEFAULT 0,
  contratos_fechados   INT DEFAULT 0,
  receita_brl          NUMERIC(12,2) DEFAULT 0,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lead_quality ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view lead_quality" ON public.lead_quality
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can manage lead_quality" ON public.lead_quality
  FOR ALL USING (is_workspace_member(auth.uid(), workspace_id));

-- Tabela 2: ciclo de vida dos criativos
CREATE TABLE IF NOT EXISTS public.creative_lifecycle (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  ad_key               TEXT NOT NULL,
  ad_name              TEXT NOT NULL,
  campaign_key         TEXT,
  adset_key            TEXT,
  format               TEXT,
  hook_type            TEXT,
  activated_at         DATE,
  days_active          INT DEFAULT 0,
  peak_ctr             NUMERIC(8,6) DEFAULT 0,
  peak_ctr_date        DATE,
  current_ctr          NUMERIC(8,6) DEFAULT 0,
  degradation_pct      NUMERIC(6,2) DEFAULT 0,
  status               TEXT DEFAULT 'active',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, ad_key)
);

ALTER TABLE public.creative_lifecycle ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view creative_lifecycle" ON public.creative_lifecycle
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Members can manage creative_lifecycle" ON public.creative_lifecycle
  FOR ALL USING (is_workspace_member(auth.uid(), workspace_id));
