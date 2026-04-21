-- Add owner_id column to teams
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON public.teams(owner_id);

-- Drop old permissive policy
DROP POLICY IF EXISTS "Allow all access to teams" ON public.teams;

-- New scoped policies
CREATE POLICY "Teams: select own or legacy"
  ON public.teams
  FOR SELECT
  USING (owner_id IS NULL OR owner_id = auth.uid());

CREATE POLICY "Teams: insert own"
  ON public.teams
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

CREATE POLICY "Teams: update own"
  ON public.teams
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Teams: delete own"
  ON public.teams
  FOR DELETE
  USING (owner_id = auth.uid());