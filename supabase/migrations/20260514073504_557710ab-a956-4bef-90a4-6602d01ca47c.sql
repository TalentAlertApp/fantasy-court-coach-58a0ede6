-- Update WNBA player Ashten Prechtel: PHX -> GSV
UPDATE public.players SET team = 'GSV', updated_at = now() WHERE id = 1641695;

-- Enable pg_cron + pg_net for scheduled triggers
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedules table for commissioner WNBA sync jobs
CREATE TABLE IF NOT EXISTS public.commissioner_sync_schedules (
  job_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  run_time_lisbon text NOT NULL DEFAULT '03:00',
  include_recaps boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  last_status text,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commissioner_sync_schedules_job_key_chk
    CHECK (job_key IN ('sync3','all')),
  CONSTRAINT commissioner_sync_schedules_time_chk
    CHECK (run_time_lisbon ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

ALTER TABLE public.commissioner_sync_schedules ENABLE ROW LEVEL SECURITY;

-- Lock down all client access; edge functions use the service role.
DROP POLICY IF EXISTS "css: deny all client access" ON public.commissioner_sync_schedules;
CREATE POLICY "css: deny all client access"
  ON public.commissioner_sync_schedules
  FOR ALL TO public
  USING (false) WITH CHECK (false);

INSERT INTO public.commissioner_sync_schedules (job_key, enabled, run_time_lisbon, include_recaps)
VALUES ('sync3', false, '03:00', false),
       ('all',   false, '04:00', false)
ON CONFLICT (job_key) DO NOTHING;
