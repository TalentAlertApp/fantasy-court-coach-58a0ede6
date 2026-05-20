ALTER TABLE public.commissioner_sync_schedules
  DROP CONSTRAINT IF EXISTS commissioner_sync_schedules_job_key_chk;

ALTER TABLE public.commissioner_sync_schedules
  ADD CONSTRAINT commissioner_sync_schedules_job_key_chk
  CHECK (job_key IN ('sync3', 'all', 'salary-auto'));

INSERT INTO public.commissioner_sync_schedules (job_key, enabled, run_time_lisbon, include_recaps)
VALUES ('salary-auto', false, '09:15', false)
ON CONFLICT (job_key) DO NOTHING;