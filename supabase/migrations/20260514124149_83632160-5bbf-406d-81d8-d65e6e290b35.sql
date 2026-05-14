-- Security definer helper to test league membership without RLS recursion.
CREATE OR REPLACE FUNCTION public.is_league_member(_league_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.league_members lm
    WHERE lm.league_id = _league_id
      AND lm.user_id = _user_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.leagues l
    WHERE l.id = _league_id
      AND l.owner_id = _user_id
  );
$$;

-- 1) leagues: replace public-read with visibility/ownership/membership read.
DROP POLICY IF EXISTS "leagues: public read" ON public.leagues;

CREATE POLICY "leagues: read public, own, or member"
  ON public.leagues
  FOR SELECT
  USING (
    visibility = 'public'
    OR owner_id = auth.uid()
    OR public.is_league_member(id, auth.uid())
  );

-- 2) scoring_daily_team_totals: restrict to league members only.
DROP POLICY IF EXISTS "scoring_daily_team_totals: public read" ON public.scoring_daily_team_totals;

CREATE POLICY "scoring_daily_team_totals: league members read"
  ON public.scoring_daily_team_totals
  FOR SELECT
  USING (
    public.is_league_member(fantasy_league_id, auth.uid())
  );

-- 3) teams: keep own-team read, ADD league-member read for leaderboards.
CREATE POLICY "teams: league members can read teams in their league"
  ON public.teams
  FOR SELECT
  USING (
    league_id IS NOT NULL
    AND public.is_league_member(league_id, auth.uid())
  );