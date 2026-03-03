
-- Add derived columns to players table (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='players' AND column_name='stocks') THEN
    ALTER TABLE public.players ADD COLUMN stocks numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='players' AND column_name='stocks5') THEN
    ALTER TABLE public.players ADD COLUMN stocks5 numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='players' AND column_name='delta_mpg') THEN
    ALTER TABLE public.players ADD COLUMN delta_mpg numeric NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='players' AND column_name='delta_fp') THEN
    ALTER TABLE public.players ADD COLUMN delta_fp numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Create player_game_logs table
CREATE TABLE IF NOT EXISTS public.player_game_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id integer NOT NULL,
  game_id text NOT NULL,
  game_date date,
  matchup text,
  opp text,
  home_away text,
  mp integer NOT NULL DEFAULT 0,
  pts integer NOT NULL DEFAULT 0,
  ast integer NOT NULL DEFAULT 0,
  reb integer NOT NULL DEFAULT 0,
  blk integer NOT NULL DEFAULT 0,
  stl integer NOT NULL DEFAULT 0,
  fp numeric NOT NULL DEFAULT 0,
  nba_game_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id, game_id)
);

ALTER TABLE public.player_game_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to player_game_logs" ON public.player_game_logs FOR ALL USING (true) WITH CHECK (true);

-- Create games table
CREATE TABLE IF NOT EXISTS public.games (
  game_id text PRIMARY KEY,
  game_date date,
  away_team text,
  home_team text,
  away_pts integer DEFAULT 0,
  home_pts integer DEFAULT 0,
  status text NOT NULL DEFAULT 'SCHEDULED',
  nba_game_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to games" ON public.games FOR ALL USING (true) WITH CHECK (true);

-- Create sync_runs table
CREATE TABLE IF NOT EXISTS public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  status text NOT NULL DEFAULT 'RUNNING',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to sync_runs" ON public.sync_runs FOR ALL USING (true) WITH CHECK (true);
