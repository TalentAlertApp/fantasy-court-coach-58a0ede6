
-- ── MVP security lockdown ────────────────────────────────────────────────
-- Replace permissive USING (true) write policies on every public table with
-- restricted access:
--   • players, games, player_game_logs, player_last_game, schedule_games:
--     public READ only (writes restricted to the service role used by edge fns)
--   • team_settings, transactions: scoped to owner of the team (or legacy)
--   • sync_runs: service-role only (no public read or write)
--
-- Edge functions that use SUPABASE_SERVICE_ROLE_KEY bypass RLS, so all
-- existing admin/data-import flows continue to work; what stops working is
-- direct anon writes from the browser.

-- ── players (read-only public catalog) ──────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to players" ON public.players;
DROP POLICY IF EXISTS "Players: public read" ON public.players;
CREATE POLICY "Players: public read"
  ON public.players FOR SELECT
  USING (true);

-- ── games (read-only public catalog) ────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to games" ON public.games;
DROP POLICY IF EXISTS "Games: public read" ON public.games;
CREATE POLICY "Games: public read"
  ON public.games FOR SELECT
  USING (true);

-- ── player_game_logs (read-only public catalog) ─────────────────────────
DROP POLICY IF EXISTS "Allow all access to player_game_logs" ON public.player_game_logs;
DROP POLICY IF EXISTS "PGL: public read" ON public.player_game_logs;
CREATE POLICY "PGL: public read"
  ON public.player_game_logs FOR SELECT
  USING (true);

-- ── player_last_game (read-only public catalog) ─────────────────────────
DROP POLICY IF EXISTS "Allow all access to player_last_game" ON public.player_last_game;
DROP POLICY IF EXISTS "PLG: public read" ON public.player_last_game;
CREATE POLICY "PLG: public read"
  ON public.player_last_game FOR SELECT
  USING (true);

-- ── schedule_games (read-only public catalog) ───────────────────────────
DROP POLICY IF EXISTS "Allow all access to schedule_games" ON public.schedule_games;
DROP POLICY IF EXISTS "Schedule: public read" ON public.schedule_games;
CREATE POLICY "Schedule: public read"
  ON public.schedule_games FOR SELECT
  USING (true);

-- ── sync_runs (service-role only) ───────────────────────────────────────
DROP POLICY IF EXISTS "Allow all access to sync_runs" ON public.sync_runs;
-- No new policy: anon/authenticated callers cannot read or write sync_runs.

-- ── team_settings (scoped to team owner or legacy) ──────────────────────
DROP POLICY IF EXISTS "Allow all access to team_settings" ON public.team_settings;
DROP POLICY IF EXISTS "TS: select own or legacy" ON public.team_settings;
DROP POLICY IF EXISTS "TS: insert own or legacy" ON public.team_settings;
DROP POLICY IF EXISTS "TS: update own or legacy" ON public.team_settings;
DROP POLICY IF EXISTS "TS: delete own or legacy" ON public.team_settings;

CREATE POLICY "TS: select own or legacy"
  ON public.team_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_settings.team_id
        AND (t.owner_id IS NULL OR t.owner_id = auth.uid())
    )
  );

CREATE POLICY "TS: insert own or legacy"
  ON public.team_settings FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_settings.team_id
        AND (t.owner_id IS NULL OR t.owner_id = auth.uid())
    )
  );

CREATE POLICY "TS: update own or legacy"
  ON public.team_settings FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_settings.team_id
        AND (t.owner_id IS NULL OR t.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_settings.team_id
        AND (t.owner_id IS NULL OR t.owner_id = auth.uid())
    )
  );

CREATE POLICY "TS: delete own or legacy"
  ON public.team_settings FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_settings.team_id
        AND (t.owner_id IS NULL OR t.owner_id = auth.uid())
    )
  );

-- ── transactions (scoped to team owner or legacy) ───────────────────────
DROP POLICY IF EXISTS "Allow all access to transactions" ON public.transactions;
DROP POLICY IF EXISTS "TX: select own or legacy" ON public.transactions;
DROP POLICY IF EXISTS "TX: insert own or legacy" ON public.transactions;
DROP POLICY IF EXISTS "TX: update own or legacy" ON public.transactions;
DROP POLICY IF EXISTS "TX: delete own or legacy" ON public.transactions;

CREATE POLICY "TX: select own or legacy"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = transactions.team_id
        AND (t.owner_id IS NULL OR t.owner_id = auth.uid())
    )
  );

CREATE POLICY "TX: insert own or legacy"
  ON public.transactions FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = transactions.team_id
        AND (t.owner_id IS NULL OR t.owner_id = auth.uid())
    )
  );

CREATE POLICY "TX: update own or legacy"
  ON public.transactions FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = transactions.team_id
        AND (t.owner_id IS NULL OR t.owner_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = transactions.team_id
        AND (t.owner_id IS NULL OR t.owner_id = auth.uid())
    )
  );

CREATE POLICY "TX: delete own or legacy"
  ON public.transactions FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = transactions.team_id
        AND (t.owner_id IS NULL OR t.owner_id = auth.uid())
    )
  );
