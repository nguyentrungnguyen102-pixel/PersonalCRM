-- =====================================================================
-- PersonalCRM — Phase 4: cron goi daily-digest 0:00 UTC (= 7:00 VN)
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'daily-digest',
  '0 0 * * *',
  $$
  select net.http_post(
    url := 'https://yzlpegtomgtdiwvuvftw.supabase.co/functions/v1/daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6bHBlZ3RvbWd0ZGl3dnV2ZnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzMjEzMDMsImV4cCI6MjA5ODg5NzMwM30.3Io_FD3IDCylnfuXqHEehrrstvfCdFHEPCRRltxv5VU'
    ),
    body := '{}'::jsonb
  );
  $$
);
