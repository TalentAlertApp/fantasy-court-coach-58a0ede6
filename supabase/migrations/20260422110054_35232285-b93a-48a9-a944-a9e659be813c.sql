-- Allow any authenticated user to manage rosters belonging to legacy teams
-- (owner_id IS NULL) so JGChieira / JdChiara can be used as shared sandboxes.

DROP POLICY IF EXISTS "Allow all access to roster" ON public.roster;
DROP POLICY IF EXISTS "Roster: select own or legacy" ON public.roster;
DROP POLICY IF EXISTS "Roster: insert own or legacy" ON public.roster;
DROP POLICY IF EXISTS "Roster: update own or legacy" ON public.roster;
DROP POLICY IF EXISTS "Roster: delete own or legacy" ON public.roster;

CREATE POLICY "Roster: select own or legacy"
  ON public.roster
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = roster.team_id
        AND (t.owner_id IS NULL OR t.owner_id = auth.uid())
    )
  );

CREATE POLICY "Roster: insert own or legacy"
  ON public.roster
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = roster.team_id
        AND (t.owner_id IS NULL OR t.owner_id = auth.uid())
    )
  );

CREATE POLICY "Roster: update own or legacy"
  ON public.roster
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = roster.team_id
        AND (t.owner_id IS NULL OR t.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = roster.team_id
        AND (t.owner_id IS NULL OR t.owner_id = auth.uid())
    )
  );

CREATE POLICY "Roster: delete own or legacy"
  ON public.roster
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = roster.team_id
        AND (t.owner_id IS NULL OR t.owner_id = auth.uid())
    )
  );