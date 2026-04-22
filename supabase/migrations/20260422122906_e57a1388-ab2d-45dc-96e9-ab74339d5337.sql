-- 1. Reassign legacy ownerless teams to jgchieira@gmail.com
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'jgchieira@gmail.com' LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User jgchieira@gmail.com not found in auth.users';
  END IF;
  UPDATE public.teams SET owner_id = v_user_id WHERE owner_id IS NULL;
END $$;

-- 2. Enforce ownership going forward
ALTER TABLE public.teams ALTER COLUMN owner_id SET NOT NULL;

-- 3. TEAMS: replace permissive select policy
DROP POLICY IF EXISTS "Teams: select own or legacy" ON public.teams;
CREATE POLICY "Teams: select own"
  ON public.teams FOR SELECT
  USING (owner_id = auth.uid());

-- 4. ROSTER: replace all "own or legacy" policies with strict owner-only
DROP POLICY IF EXISTS "Roster: select own or legacy" ON public.roster;
DROP POLICY IF EXISTS "Roster: insert own or legacy" ON public.roster;
DROP POLICY IF EXISTS "Roster: update own or legacy" ON public.roster;
DROP POLICY IF EXISTS "Roster: delete own or legacy" ON public.roster;

CREATE POLICY "Roster: select own" ON public.roster FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = roster.team_id AND t.owner_id = auth.uid()));
CREATE POLICY "Roster: insert own" ON public.roster FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = roster.team_id AND t.owner_id = auth.uid()));
CREATE POLICY "Roster: update own" ON public.roster FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = roster.team_id AND t.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = roster.team_id AND t.owner_id = auth.uid()));
CREATE POLICY "Roster: delete own" ON public.roster FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = roster.team_id AND t.owner_id = auth.uid()));

-- 5. TEAM_SETTINGS: same hardening
DROP POLICY IF EXISTS "TS: select own or legacy" ON public.team_settings;
DROP POLICY IF EXISTS "TS: insert own or legacy" ON public.team_settings;
DROP POLICY IF EXISTS "TS: update own or legacy" ON public.team_settings;
DROP POLICY IF EXISTS "TS: delete own or legacy" ON public.team_settings;

CREATE POLICY "TS: select own" ON public.team_settings FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_settings.team_id AND t.owner_id = auth.uid()));
CREATE POLICY "TS: insert own" ON public.team_settings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_settings.team_id AND t.owner_id = auth.uid()));
CREATE POLICY "TS: update own" ON public.team_settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_settings.team_id AND t.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_settings.team_id AND t.owner_id = auth.uid()));
CREATE POLICY "TS: delete own" ON public.team_settings FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_settings.team_id AND t.owner_id = auth.uid()));

-- 6. TRANSACTIONS: same hardening
DROP POLICY IF EXISTS "TX: select own or legacy" ON public.transactions;
DROP POLICY IF EXISTS "TX: insert own or legacy" ON public.transactions;
DROP POLICY IF EXISTS "TX: update own or legacy" ON public.transactions;
DROP POLICY IF EXISTS "TX: delete own or legacy" ON public.transactions;

CREATE POLICY "TX: select own" ON public.transactions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = transactions.team_id AND t.owner_id = auth.uid()));
CREATE POLICY "TX: insert own" ON public.transactions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = transactions.team_id AND t.owner_id = auth.uid()));
CREATE POLICY "TX: update own" ON public.transactions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = transactions.team_id AND t.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = transactions.team_id AND t.owner_id = auth.uid()));
CREATE POLICY "TX: delete own" ON public.transactions FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = transactions.team_id AND t.owner_id = auth.uid()));

-- 7. SYNC_RUNS: explicit deny-all for client access (service role bypasses RLS)
CREATE POLICY "sync_runs: deny all client access"
  ON public.sync_runs FOR ALL
  USING (false)
  WITH CHECK (false);