
-- Players table
CREATE TABLE public.players (
  id integer PRIMARY KEY,
  name text NOT NULL,
  team text NOT NULL,
  fc_bc text NOT NULL CHECK (fc_bc IN ('FC', 'BC')),
  photo text,
  salary numeric NOT NULL DEFAULT 0,
  jersey integer NOT NULL DEFAULT 0,
  pos text,
  height text,
  weight integer NOT NULL DEFAULT 0,
  age integer NOT NULL DEFAULT 0,
  dob text,
  exp integer NOT NULL DEFAULT 0,
  college text,
  gp integer NOT NULL DEFAULT 0,
  mpg numeric NOT NULL DEFAULT 0,
  pts numeric NOT NULL DEFAULT 0,
  reb numeric NOT NULL DEFAULT 0,
  ast numeric NOT NULL DEFAULT 0,
  stl numeric NOT NULL DEFAULT 0,
  blk numeric NOT NULL DEFAULT 0,
  fp_pg_t numeric NOT NULL DEFAULT 0,
  value_t numeric NOT NULL DEFAULT 0,
  mpg5 numeric NOT NULL DEFAULT 0,
  pts5 numeric NOT NULL DEFAULT 0,
  reb5 numeric NOT NULL DEFAULT 0,
  ast5 numeric NOT NULL DEFAULT 0,
  stl5 numeric NOT NULL DEFAULT 0,
  blk5 numeric NOT NULL DEFAULT 0,
  fp_pg5 numeric NOT NULL DEFAULT 0,
  value5 numeric NOT NULL DEFAULT 0,
  injury text CHECK (injury IN ('OUT', 'Q', 'DTD')),
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Player last game table
CREATE TABLE public.player_last_game (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id integer NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  game_date text,
  opp text,
  home_away text CHECK (home_away IN ('H', 'A')),
  result text,
  a_pts integer NOT NULL DEFAULT 0,
  h_pts integer NOT NULL DEFAULT 0,
  mp integer NOT NULL DEFAULT 0,
  pts integer NOT NULL DEFAULT 0,
  reb integer NOT NULL DEFAULT 0,
  ast integer NOT NULL DEFAULT 0,
  stl integer NOT NULL DEFAULT 0,
  blk integer NOT NULL DEFAULT 0,
  fp numeric NOT NULL DEFAULT 0,
  nba_game_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id)
);

-- Roster table
CREATE TABLE public.roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot text NOT NULL CHECK (slot IN ('STARTER', 'BENCH')),
  player_id integer NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  is_captain boolean NOT NULL DEFAULT false,
  gw integer NOT NULL DEFAULT 1,
  day integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Transactions table
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  type text NOT NULL CHECK (type IN ('ADD', 'DROP', 'SWAP', 'CAPTAIN_CHANGE')),
  player_in_id integer NOT NULL DEFAULT 0,
  player_out_id integer NOT NULL DEFAULT 0,
  cost_points numeric NOT NULL DEFAULT 0,
  notes text
);

-- Schedule games table
CREATE TABLE public.schedule_games (
  game_id text PRIMARY KEY,
  gw integer NOT NULL DEFAULT 1,
  day integer NOT NULL DEFAULT 1,
  tipoff_utc timestamptz,
  away_team text NOT NULL,
  home_team text NOT NULL,
  away_pts integer NOT NULL DEFAULT 0,
  home_pts integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'FINAL')),
  nba_game_url text
);

-- No RLS needed - single-user private app
-- But we must enable RLS and add permissive policies to satisfy Supabase requirements
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_last_game ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_games ENABLE ROW LEVEL SECURITY;

-- Allow all access (single-user private app)
CREATE POLICY "Allow all access to players" ON public.players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to player_last_game" ON public.player_last_game FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to roster" ON public.roster FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to schedule_games" ON public.schedule_games FOR ALL USING (true) WITH CHECK (true);
