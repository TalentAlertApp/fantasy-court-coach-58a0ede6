SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'commissioner-schedule-tick';

SELECT cron.schedule(
  'commissioner-schedule-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jtewuekavaujgnynmpaq.supabase.co/functions/v1/commissioner-schedule-tick',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZXd1ZWthdmF1amdueW5tcGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzE2MTcsImV4cCI6MjA4ODEwNzYxN30.ooXNRN9p2EKJlnGNph6NXIZ9xw3QZQqyjKdBxFagroU"}'::jsonb,
    body := concat('{"t":"', now(), '"}')::jsonb
  ) AS request_id;
  $$
);
