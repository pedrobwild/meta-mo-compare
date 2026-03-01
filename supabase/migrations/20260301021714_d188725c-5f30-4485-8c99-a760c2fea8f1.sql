CREATE TABLE public.decisions_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_key TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_key TEXT NOT NULL,
  action_type TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.decisions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON public.decisions_log FOR SELECT USING (true);
CREATE POLICY "Public insert access" ON public.decisions_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete access" ON public.decisions_log FOR DELETE USING (true);