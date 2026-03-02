
SELECT cron.schedule(
  'classify-creative-lifecycle-daily',
  '0 6 * * *',
  $$SELECT extensions.http_post(
    url := 'https://uziafykdgmibcpttagmr.supabase.co/functions/v1/classify-creative-lifecycle',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6aWFmeWtkZ21pYmNwdHRhZ21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTI5MjEsImV4cCI6MjA4Nzg4ODkyMX0.FmDCa877YoBcVeKpy7vDjt499IvbyaVWCiPUDvF-_AY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id$$
);
