-- Allow live in-progress status strings (e.g. "Q3 3:56", "HALF", "OT 2:14")
-- on schedule_games.status. Previously the CHECK constraint only accepted
-- 'SCHEDULED' or 'FINAL', which made the sheet sync silently reject live
-- updates and kept LIVE game cards stuck at 0-0.
ALTER TABLE public.schedule_games
  DROP CONSTRAINT IF EXISTS schedule_games_status_check;

ALTER TABLE public.schedule_games
  ADD CONSTRAINT schedule_games_status_check
  CHECK (
    status IN ('SCHEDULED','FINAL','LIVE','IN_PROGRESS','HALF','HALFTIME','DELAY','PRE')
    OR status ~ '^(Q[1-4]|END|HALF|OT)'
  );
