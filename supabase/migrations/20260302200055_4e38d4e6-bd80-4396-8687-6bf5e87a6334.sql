
-- UTM links history table
CREATE TABLE public.utm_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  base_url text NOT NULL DEFAULT '',
  full_url text NOT NULL DEFAULT '',
  utm_source text NOT NULL DEFAULT '',
  utm_medium text NOT NULL DEFAULT 'paid',
  utm_campaign text NOT NULL DEFAULT '',
  utm_content text,
  utm_term text,
  platform text NOT NULL DEFAULT 'meta',
  objetivo text NOT NULL DEFAULT 'LEADS',
  funil text NOT NULL DEFAULT 'TOFU',
  pais text NOT NULL DEFAULT 'BR',
  produto text,
  mes_ano text,
  conjunto text,
  nome_anuncio text,
  publico text
);

ALTER TABLE public.utm_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view utm_links" ON public.utm_links FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can insert utm_links" ON public.utm_links FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can delete utm_links" ON public.utm_links FOR DELETE TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE INDEX idx_utm_links_workspace ON public.utm_links(workspace_id, created_at DESC);
