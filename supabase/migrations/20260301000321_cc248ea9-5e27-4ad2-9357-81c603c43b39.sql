
-- Add period columns to meta_records
ALTER TABLE public.meta_records
  ADD COLUMN IF NOT EXISTS period_start text,
  ADD COLUMN IF NOT EXISTS period_end text,
  ADD COLUMN IF NOT EXISTS period_key text,
  ADD COLUMN IF NOT EXISTS granularity text NOT NULL DEFAULT 'week';

-- Backfill period columns from existing data
UPDATE public.meta_records
SET
  period_start = COALESCE(report_start, 'unknown'),
  period_end = COALESCE(report_end, report_start, 'unknown'),
  period_key = COALESCE(month_key, 'unknown'),
  granularity = 'week'
WHERE period_key IS NULL;

-- Drop old unique constraint and create new one
-- First find and drop the existing constraint on unique_key,month_key
DO $$
BEGIN
  -- Drop index if exists (the upsert uses this)
  DROP INDEX IF EXISTS meta_records_unique_key_month_key_idx;
  
  -- Try to drop constraint if it exists
  BEGIN
    ALTER TABLE public.meta_records DROP CONSTRAINT IF EXISTS meta_records_unique_key_month_key_key;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
  
  BEGIN
    ALTER TABLE public.meta_records DROP CONSTRAINT IF EXISTS meta_records_unique_key_key;
  EXCEPTION WHEN undefined_object THEN
    NULL;
  END;
END $$;

-- Create new unique constraint for period-based upsert
CREATE UNIQUE INDEX IF NOT EXISTS meta_records_unique_key_period_idx
  ON public.meta_records (unique_key, period_key, granularity);

-- Add period columns to monthly_targets
ALTER TABLE public.monthly_targets
  ADD COLUMN IF NOT EXISTS period_key text,
  ADD COLUMN IF NOT EXISTS granularity text NOT NULL DEFAULT 'week';

-- Backfill
UPDATE public.monthly_targets
SET period_key = month_key, granularity = 'week'
WHERE period_key IS NULL;

-- Add period columns to funnel_data  
ALTER TABLE public.funnel_data
  ADD COLUMN IF NOT EXISTS period_key text,
  ADD COLUMN IF NOT EXISTS granularity text NOT NULL DEFAULT 'week';

-- Backfill
UPDATE public.funnel_data
SET period_key = month_key, granularity = 'week'
WHERE period_key IS NULL;
