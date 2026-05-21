
-- Many-to-many: a team can participate in many fantasy leagues; a single
-- roster on the team is shared across all of them.
CREATE TABLE IF NOT EXISTS public.team_leagues (
  team_id   uuid NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, league_id)
);

CREATE INDEX IF NOT EXISTS team_leagues_league_idx ON public.team_leagues(league_id);
CREATE INDEX IF NOT EXISTS team_leagues_team_idx   ON public.team_leagues(team_id);

ALTER TABLE public.team_leagues ENABLE ROW LEVEL SECURITY;

-- SELECT: the team owner OR a member of the league can read the participation row
CREATE POLICY "team_leagues: select own or league member"
ON public.team_leagues
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_leagues.team_id AND t.owner_id = auth.uid())
  OR public.is_league_member(team_leagues.league_id, auth.uid())
);

-- INSERT: only the team owner can attach their team to a league
CREATE POLICY "team_leagues: insert by team owner"
ON public.team_leagues
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_leagues.team_id AND t.owner_id = auth.uid())
);

-- DELETE: only the team owner can detach
CREATE POLICY "team_leagues: delete by team owner"
ON public.team_leagues
FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_leagues.team_id AND t.owner_id = auth.uid())
);

-- Backfill from existing teams.league_id (one row per existing team)
INSERT INTO public.team_leagues (team_id, league_id)
SELECT id, league_id FROM public.teams
WHERE league_id IS NOT NULL
ON CONFLICT (team_id, league_id) DO NOTHING;
