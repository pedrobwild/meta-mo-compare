
-- Tabela: audience_demographics
CREATE TABLE public.audience_demographics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  date date NOT NULL,
  source text NOT NULL DEFAULT 'meta_ads',
  campaign_id text,
  age_range text NOT NULL DEFAULT '',
  gender text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  spend numeric NOT NULL DEFAULT 0,
  leads bigint NOT NULL DEFAULT 0,
  mql bigint NOT NULL DEFAULT 0,
  sql_count bigint NOT NULL DEFAULT 0,
  conversions bigint NOT NULL DEFAULT 0,
  revenue numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audience_demographics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view audience_demographics" ON public.audience_demographics FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can manage audience_demographics" ON public.audience_demographics FOR ALL USING (is_workspace_member(auth.uid(), workspace_id));

CREATE UNIQUE INDEX idx_audience_demo_upsert ON public.audience_demographics (workspace_id, date, source, COALESCE(campaign_id,''), age_range, gender, country, city, region);

-- Tabela: audience_interests
CREATE TABLE public.audience_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  date date NOT NULL,
  interest_name text NOT NULL DEFAULT '',
  interest_category text NOT NULL DEFAULT '',
  reach bigint NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0,
  cpl numeric NOT NULL DEFAULT 0,
  mql_rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audience_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view audience_interests" ON public.audience_interests FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can manage audience_interests" ON public.audience_interests FOR ALL USING (is_workspace_member(auth.uid(), workspace_id));

-- Tabela: persona_profiles
CREATE TABLE public.persona_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  age_range text NOT NULL DEFAULT '',
  gender text NOT NULL DEFAULT '',
  top_cities text[] NOT NULL DEFAULT '{}',
  top_interests text[] NOT NULL DEFAULT '{}',
  avg_cpl numeric NOT NULL DEFAULT 0,
  avg_mql_rate numeric NOT NULL DEFAULT 0,
  avg_sql_rate numeric NOT NULL DEFAULT 0,
  avg_close_rate numeric NOT NULL DEFAULT 0,
  avg_deal_value numeric NOT NULL DEFAULT 0,
  best_performing_creative_angle text,
  best_performing_placement text,
  best_day_of_week text,
  best_hour_of_day int,
  total_leads bigint NOT NULL DEFAULT 0,
  total_revenue numeric NOT NULL DEFAULT 0,
  roas_real numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.persona_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view persona_profiles" ON public.persona_profiles FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can manage persona_profiles" ON public.persona_profiles FOR ALL USING (is_workspace_member(auth.uid(), workspace_id));

-- Tabela: audience_device_data
CREATE TABLE public.audience_device_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  date date NOT NULL,
  device_type text NOT NULL DEFAULT '',
  platform text NOT NULL DEFAULT '',
  placement text NOT NULL DEFAULT '',
  impressions bigint NOT NULL DEFAULT 0,
  clicks bigint NOT NULL DEFAULT 0,
  leads bigint NOT NULL DEFAULT 0,
  cpl numeric NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audience_device_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view audience_device_data" ON public.audience_device_data FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can manage audience_device_data" ON public.audience_device_data FOR ALL USING (is_workspace_member(auth.uid(), workspace_id));

CREATE UNIQUE INDEX idx_audience_device_upsert ON public.audience_device_data (workspace_id, date, device_type, platform, placement);
