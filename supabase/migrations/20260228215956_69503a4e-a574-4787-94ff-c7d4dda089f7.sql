-- Table for Meta Ads records
CREATE TABLE public.meta_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unique_key TEXT NOT NULL,
  month_key TEXT NOT NULL,
  ad_key TEXT NOT NULL,
  campaign_key TEXT,
  adset_key TEXT,
  source_type TEXT NOT NULL DEFAULT 'type3_full',
  ad_name TEXT NOT NULL,
  campaign_name TEXT,
  adset_name TEXT,
  delivery_status TEXT,
  delivery_level TEXT,
  result_type TEXT,
  results NUMERIC NOT NULL DEFAULT 0,
  reach NUMERIC NOT NULL DEFAULT 0,
  frequency NUMERIC NOT NULL DEFAULT 0,
  cost_per_result NUMERIC NOT NULL DEFAULT 0,
  spend_brl NUMERIC NOT NULL DEFAULT 0,
  impressions NUMERIC NOT NULL DEFAULT 0,
  cpm NUMERIC NOT NULL DEFAULT 0,
  link_clicks NUMERIC NOT NULL DEFAULT 0,
  cpc_link NUMERIC NOT NULL DEFAULT 0,
  ctr_link NUMERIC NOT NULL DEFAULT 0,
  clicks_all NUMERIC NOT NULL DEFAULT 0,
  ctr_all NUMERIC NOT NULL DEFAULT 0,
  cpc_all NUMERIC NOT NULL DEFAULT 0,
  landing_page_views NUMERIC NOT NULL DEFAULT 0,
  cost_per_lpv NUMERIC NOT NULL DEFAULT 0,
  report_start TEXT,
  report_end TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_record UNIQUE (unique_key, month_key)
);

-- Table for monthly targets
CREATE TABLE public.monthly_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_key TEXT NOT NULL UNIQUE,
  spend NUMERIC,
  results NUMERIC,
  ctr_link NUMERIC,
  cpc_link NUMERIC,
  cpm NUMERIC,
  lpv NUMERIC,
  cost_per_result NUMERIC,
  cost_per_lpv NUMERIC,
  mql NUMERIC,
  sql_target NUMERIC,
  vendas NUMERIC,
  receita NUMERIC,
  roas NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for funnel data
CREATE TABLE public.funnel_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_key TEXT NOT NULL UNIQUE,
  mql NUMERIC NOT NULL DEFAULT 0,
  sql_count NUMERIC NOT NULL DEFAULT 0,
  vendas NUMERIC NOT NULL DEFAULT 0,
  receita NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS but allow public access
ALTER TABLE public.meta_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON public.meta_records FOR SELECT USING (true);
CREATE POLICY "Public insert access" ON public.meta_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access" ON public.meta_records FOR UPDATE USING (true);
CREATE POLICY "Public delete access" ON public.meta_records FOR DELETE USING (true);

CREATE POLICY "Public read access" ON public.monthly_targets FOR SELECT USING (true);
CREATE POLICY "Public insert access" ON public.monthly_targets FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access" ON public.monthly_targets FOR UPDATE USING (true);
CREATE POLICY "Public delete access" ON public.monthly_targets FOR DELETE USING (true);

CREATE POLICY "Public read access" ON public.funnel_data FOR SELECT USING (true);
CREATE POLICY "Public insert access" ON public.funnel_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access" ON public.funnel_data FOR UPDATE USING (true);
CREATE POLICY "Public delete access" ON public.funnel_data FOR DELETE USING (true);