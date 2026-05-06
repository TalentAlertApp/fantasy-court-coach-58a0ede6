
-- ============================================================
-- Prompt 2 prerequisite: league-safe schema
-- ============================================================

-- 1) Differentiate fantasy vs sport rows in leagues
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS kind  text NOT NULL DEFAULT 'fantasy',
  ADD COLUMN IF NOT EXISTS sport text;

-- 2) Insert NBA + WNBA sport-league rows (reuse existing scoring system)
INSERT INTO public.leagues (code, name, kind, sport, scoring_system_id, is_active)
SELECT 'nba', 'NBA', 'sport', 'nba',
       '00000000-0000-0000-0000-000000000001'::uuid, true
WHERE NOT EXISTS (SELECT 1 FROM public.leagues WHERE code='nba');

INSERT INTO public.leagues (code, name, kind, sport, scoring_system_id, is_active)
SELECT 'wnba', 'WNBA', 'sport', 'wnba',
       '00000000-0000-0000-0000-000000000001'::uuid, true
WHERE NOT EXISTS (SELECT 1 FROM public.leagues WHERE code='wnba');

-- 3) Add league_id columns (nullable, then backfill)
ALTER TABLE public.players          ADD COLUMN IF NOT EXISTS league_id uuid;
ALTER TABLE public.games            ADD COLUMN IF NOT EXISTS league_id uuid;
ALTER TABLE public.schedule_games   ADD COLUMN IF NOT EXISTS league_id uuid;
ALTER TABLE public.player_game_logs ADD COLUMN IF NOT EXISTS league_id uuid;
ALTER TABLE public.player_last_game ADD COLUMN IF NOT EXISTS league_id uuid;
ALTER TABLE public.transactions     ADD COLUMN IF NOT EXISTS league_id uuid;
ALTER TABLE public.roster           ADD COLUMN IF NOT EXISTS league_id uuid;
ALTER TABLE public.teams            ADD COLUMN IF NOT EXISTS sport_league_id uuid;

-- 4) Backfill all existing rows with NBA league_id
DO $$
DECLARE nba_id uuid;
BEGIN
  SELECT id INTO nba_id FROM public.leagues WHERE code='nba' LIMIT 1;

  UPDATE public.players          SET league_id = nba_id WHERE league_id IS NULL;
  UPDATE public.games            SET league_id = nba_id WHERE league_id IS NULL;
  UPDATE public.schedule_games   SET league_id = nba_id WHERE league_id IS NULL;
  UPDATE public.player_game_logs SET league_id = nba_id WHERE league_id IS NULL;
  UPDATE public.player_last_game SET league_id = nba_id WHERE league_id IS NULL;
  UPDATE public.transactions     SET league_id = nba_id WHERE league_id IS NULL;
  UPDATE public.roster           SET league_id = nba_id WHERE league_id IS NULL;
  UPDATE public.teams            SET sport_league_id = nba_id WHERE sport_league_id IS NULL;
END $$;

-- 5) Enforce NOT NULL + FK after backfill
ALTER TABLE public.players          ALTER COLUMN league_id SET NOT NULL;
ALTER TABLE public.games            ALTER COLUMN league_id SET NOT NULL;
ALTER TABLE public.schedule_games   ALTER COLUMN league_id SET NOT NULL;
ALTER TABLE public.player_game_logs ALTER COLUMN league_id SET NOT NULL;
ALTER TABLE public.player_last_game ALTER COLUMN league_id SET NOT NULL;
ALTER TABLE public.transactions     ALTER COLUMN league_id SET NOT NULL;
ALTER TABLE public.roster           ALTER COLUMN league_id SET NOT NULL;
ALTER TABLE public.teams            ALTER COLUMN sport_league_id SET NOT NULL;

ALTER TABLE public.players          ADD CONSTRAINT players_league_fk          FOREIGN KEY (league_id) REFERENCES public.leagues(id);
ALTER TABLE public.games            ADD CONSTRAINT games_league_fk            FOREIGN KEY (league_id) REFERENCES public.leagues(id);
ALTER TABLE public.schedule_games   ADD CONSTRAINT schedgames_league_fk       FOREIGN KEY (league_id) REFERENCES public.leagues(id);
ALTER TABLE public.player_game_logs ADD CONSTRAINT pgl_league_fk              FOREIGN KEY (league_id) REFERENCES public.leagues(id);
ALTER TABLE public.player_last_game ADD CONSTRAINT plg_league_fk              FOREIGN KEY (league_id) REFERENCES public.leagues(id);
ALTER TABLE public.transactions     ADD CONSTRAINT tx_league_fk               FOREIGN KEY (league_id) REFERENCES public.leagues(id);
ALTER TABLE public.roster           ADD CONSTRAINT roster_league_fk           FOREIGN KEY (league_id) REFERENCES public.leagues(id);
ALTER TABLE public.teams            ADD CONSTRAINT teams_sport_league_fk      FOREIGN KEY (sport_league_id) REFERENCES public.leagues(id);

-- 6) Player identity safe for multi-league
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS source_league    text,
  ADD COLUMN IF NOT EXISTS source_player_id text,
  ADD COLUMN IF NOT EXISTS source_url       text;

UPDATE public.players
   SET source_league   = 'nba',
       source_player_id = id::text
 WHERE source_league IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS players_source_uniq
  ON public.players (source_league, source_player_id);

-- 7) Indexes
CREATE INDEX IF NOT EXISTS idx_players_league_team       ON public.players(league_id, team);
CREATE INDEX IF NOT EXISTS idx_players_league_fcbc       ON public.players(league_id, fc_bc);
CREATE INDEX IF NOT EXISTS idx_players_league_name       ON public.players(league_id, name);
CREATE INDEX IF NOT EXISTS idx_schedgames_league_gw_day  ON public.schedule_games(league_id, gw, day, tipoff_utc);
CREATE INDEX IF NOT EXISTS idx_pgl_league_player_date    ON public.player_game_logs(league_id, player_id, game_date);
CREATE INDEX IF NOT EXISTS idx_games_league_date         ON public.games(league_id, game_date);
CREATE INDEX IF NOT EXISTS idx_plg_league_player         ON public.player_last_game(league_id, player_id);
