-- Add notes column to decisions_log for manual annotations
ALTER TABLE public.decisions_log ADD COLUMN IF NOT EXISTS notes text DEFAULT NULL;

-- Add user_id column to track who made the decision
ALTER TABLE public.decisions_log ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT NULL;

-- Add expected_result column
ALTER TABLE public.decisions_log ADD COLUMN IF NOT EXISTS expected_result text DEFAULT NULL;

-- Allow members to update decisions (for adding notes)
CREATE POLICY "Members can update decisions"
ON public.decisions_log
FOR UPDATE
USING ((workspace_id IS NULL) OR is_workspace_member(auth.uid(), workspace_id))
WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(auth.uid(), workspace_id));