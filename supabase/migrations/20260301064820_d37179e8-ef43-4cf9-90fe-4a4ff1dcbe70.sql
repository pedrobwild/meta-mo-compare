
-- Add RLS policies to tables that were created via IF NOT EXISTS (already had RLS from prev migration)
-- The INFO warnings are for tables that already have policies from the failed migration's partial success

-- Fix: Add missing policies for targets_monthly, alert_rules, alert_events, recommendations, annotations, audit_log
-- These were already created with policies in the previous successful partial migration

-- Now fix OLD legacy tables: replace USING(true) with workspace-aware or service-role-only policies
-- Legacy tables: decisions_log, funnel_data, meta_records, monthly_targets

-- decisions_log: drop old permissive policies, add workspace-aware (no workspace_id yet, add it)
ALTER TABLE public.decisions_log ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Public delete access" ON public.decisions_log;
DROP POLICY IF EXISTS "Public insert access" ON public.decisions_log;
DROP POLICY IF EXISTS "Public read access" ON public.decisions_log;

CREATE POLICY "Members can read decisions" ON public.decisions_log
  FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can insert decisions" ON public.decisions_log
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can delete decisions" ON public.decisions_log
  FOR DELETE TO authenticated
  USING (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id));

-- funnel_data: add workspace_id, fix policies
ALTER TABLE public.funnel_data ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Public delete access" ON public.funnel_data;
DROP POLICY IF EXISTS "Public insert access" ON public.funnel_data;
DROP POLICY IF EXISTS "Public read access" ON public.funnel_data;
DROP POLICY IF EXISTS "Public update access" ON public.funnel_data;

CREATE POLICY "Members can read funnel" ON public.funnel_data
  FOR SELECT TO authenticated USING (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can insert funnel" ON public.funnel_data
  FOR INSERT TO authenticated WITH CHECK (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can update funnel" ON public.funnel_data
  FOR UPDATE TO authenticated USING (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can delete funnel" ON public.funnel_data
  FOR DELETE TO authenticated USING (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id));

-- meta_records: add workspace_id, fix policies
ALTER TABLE public.meta_records ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Public delete access" ON public.meta_records;
DROP POLICY IF EXISTS "Public insert access" ON public.meta_records;
DROP POLICY IF EXISTS "Public read access" ON public.meta_records;
DROP POLICY IF EXISTS "Public update access" ON public.meta_records;

CREATE POLICY "Members can read records" ON public.meta_records
  FOR SELECT TO authenticated USING (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can insert records" ON public.meta_records
  FOR INSERT TO authenticated WITH CHECK (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can update records" ON public.meta_records
  FOR UPDATE TO authenticated USING (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can delete records" ON public.meta_records
  FOR DELETE TO authenticated USING (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id));

-- monthly_targets: add workspace_id, fix policies
ALTER TABLE public.monthly_targets ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Public delete access" ON public.monthly_targets;
DROP POLICY IF EXISTS "Public insert access" ON public.monthly_targets;
DROP POLICY IF EXISTS "Public read access" ON public.monthly_targets;
DROP POLICY IF EXISTS "Public update access" ON public.monthly_targets;

CREATE POLICY "Members can read targets" ON public.monthly_targets
  FOR SELECT TO authenticated USING (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can insert targets" ON public.monthly_targets
  FOR INSERT TO authenticated WITH CHECK (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can update targets" ON public.monthly_targets
  FOR UPDATE TO authenticated USING (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Members can delete targets" ON public.monthly_targets
  FOR DELETE TO authenticated USING (workspace_id IS NULL OR public.is_workspace_member(auth.uid(), workspace_id));
