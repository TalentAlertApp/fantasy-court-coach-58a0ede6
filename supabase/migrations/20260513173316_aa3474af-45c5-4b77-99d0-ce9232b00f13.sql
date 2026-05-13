ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS sport_league_id uuid;

DO $$
DECLARE
  nba_id uuid;
  wnba_id uuid;
BEGIN
  SELECT id INTO nba_id FROM public.leagues WHERE code = 'nba' AND kind = 'sport' LIMIT 1;
  SELECT id INTO wnba_id FROM public.leagues WHERE code = 'wnba' AND kind = 'sport' LIMIT 1;

  UPDATE public.leagues
     SET sport_league_id = CASE
       WHEN sport = 'wnba' THEN wnba_id
       WHEN sport = 'nba' THEN nba_id
       ELSE sport_league_id
     END
   WHERE kind = 'fantasy'
     AND sport_league_id IS NULL
     AND sport IN ('nba', 'wnba');
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leagues_sport_league_fk'
      AND conrelid = 'public.leagues'::regclass
  ) THEN
    ALTER TABLE public.leagues
      ADD CONSTRAINT leagues_sport_league_fk
      FOREIGN KEY (sport_league_id)
      REFERENCES public.leagues(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leagues_kind_sport_league
  ON public.leagues(kind, sport_league_id);

NOTIFY pgrst, 'reload schema';