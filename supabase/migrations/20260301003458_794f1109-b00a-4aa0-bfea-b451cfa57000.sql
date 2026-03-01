-- Drop old constraint based on month_key
ALTER TABLE public.meta_records DROP CONSTRAINT IF EXISTS unique_record;

-- Create new constraint for period-based UPSERT
ALTER TABLE public.meta_records ADD CONSTRAINT unique_record_period UNIQUE (unique_key, period_key, granularity);

-- Clear stale data to start fresh
TRUNCATE public.meta_records;