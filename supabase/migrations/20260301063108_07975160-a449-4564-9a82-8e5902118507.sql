
-- =============================================
-- PHASE 1A: MULTI-TENANT FOUNDATION
-- =============================================

-- Workspaces
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Workspace memberships
CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'analyst', 'viewer');

CREATE TABLE public.workspace_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role workspace_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;

-- Helper function: check workspace membership (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_user_id uuid, _workspace_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_memberships
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_workspace_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT workspace_id FROM public.workspace_memberships WHERE user_id = _user_id
$$;

-- RLS: workspaces
CREATE POLICY "Members can view workspace" ON public.workspaces
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), id));

CREATE POLICY "Owner can update workspace" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "Authenticated can create workspace" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

-- RLS: workspace_memberships
CREATE POLICY "Members can view memberships" ON public.workspace_memberships
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(auth.uid(), workspace_id));

CREATE POLICY "Owner/admin can manage memberships" ON public.workspace_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships wm
      WHERE wm.workspace_id = workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
    OR NOT EXISTS (SELECT 1 FROM public.workspace_memberships wm WHERE wm.workspace_id = workspace_id)
  );

CREATE POLICY "Owner/admin can delete memberships" ON public.workspace_memberships
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.workspace_memberships wm
      WHERE wm.workspace_id = workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Auto-create workspace + membership on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ws_id uuid;
BEGIN
  INSERT INTO public.workspaces (name, owner_user_id)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'Meu Workspace'), NEW.id)
  RETURNING id INTO ws_id;

  INSERT INTO public.workspace_memberships (workspace_id, user_id, role)
  VALUES (ws_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
