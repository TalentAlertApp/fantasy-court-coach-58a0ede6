
CREATE TABLE IF NOT EXISTS public.sport_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_league_id uuid NOT NULL,
  team_code text NOT NULL,
  name text NOT NULL,
  short_name text,
  city text,
  country text,
  venue_name text,
  logo_url text,
  venue_image_url text,
  roster_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sport_teams_code_per_league UNIQUE (sport_league_id, team_code)
);

CREATE INDEX IF NOT EXISTS sport_teams_sport_league_id_idx ON public.sport_teams (sport_league_id);

ALTER TABLE public.sport_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sport_teams: public read" ON public.sport_teams;
CREATE POLICY "sport_teams: public read"
  ON public.sport_teams
  FOR SELECT
  USING (true);
