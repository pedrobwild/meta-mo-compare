
-- Add missing RLS policies for tables that show INFO: RLS Enabled No Policy
-- These are: targets_monthly (new), alert_rules, alert_events, recommendations, annotations, audit_log
-- They were created by IF NOT EXISTS but their policies were already created in the earlier successful migration

-- Check which tables actually need policies by trying to create them (will fail silently if they exist)

-- targets_monthly (new one, not legacy monthly_targets)
DO $$ BEGIN
  CREATE POLICY "Members can view targets_m" ON public.targets_monthly
    FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Members can manage targets_m" ON public.targets_monthly
    FOR ALL TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Members can view alert_rules" ON public.alert_rules
    FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Members can manage alert_rules" ON public.alert_rules
    FOR ALL TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Members can view alert_events" ON public.alert_events
    FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Members can manage alert_events" ON public.alert_events
    FOR ALL TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Members can view recommendations" ON public.recommendations
    FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Members can manage recommendations" ON public.recommendations
    FOR ALL TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Members can view annotations" ON public.annotations
    FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Members can manage annotations" ON public.annotations
    FOR ALL TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Members can view audit_log" ON public.audit_log
    FOR SELECT TO authenticated USING (public.is_workspace_member(auth.uid(), workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE POLICY "Members can insert audit_log" ON public.audit_log
    FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(auth.uid(), workspace_id));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
