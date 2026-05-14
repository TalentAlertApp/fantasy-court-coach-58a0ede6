-- Allow authenticated users (and anon) to read sport league rows (NBA/WNBA)
-- and system Main League fantasy rows. These rows have owner_id IS NULL and
-- visibility = 'private', so the existing
-- "leagues: read public, own, or member" policy hides them, which breaks
-- every client query that resolves a sport league id (TeamModal, /teams,
-- /schedule helpers, roster gameweek slots, /leagues main league cards, …).
--
-- Sport leagues (kind='sport') and system fantasy main leagues
-- (kind='fantasy' AND owner_id IS NULL AND code IN ('main','main_wnba'))
-- contain only metadata — names, codes, sport, rule-set ids — never any
-- per-user data. Exposing them is safe and intended.
CREATE POLICY "leagues: read sport and main system rows"
ON public.leagues
FOR SELECT
USING (
  kind = 'sport'
  OR (kind = 'fantasy' AND owner_id IS NULL AND code IN ('main', 'main_wnba'))
);
