## What is actually broken

- **Injury persistence:** the Edge Function is matching players correctly, but every update fails because `players.injury` has a database check constraint that only accepts `OUT`, `Q`, or `DTD`. The function is trying to write labels like `Out — Calf`, so Postgres rejects all 117 updates. Aaron Gordon remains `null` because the update never commits.
- **Game Detail modal:** the app is already mostly using `GameDetailModal`, but Player Modal history also has a separate older “Game Box Score” dialog and the history payload does not include recap link fields from `schedule_games`, so the green `Tv2` recap affordance cannot reliably show there.
- **Roster header:** Quick Actions is still amber/yellow, too close to the light-theme background; Ballers.IQ wordmark theme assets are reversed from the requested visual result.
- **Collapsed sidebar:** CSS rules were added, but the collapsed column still has inconsistent structural padding/axis alignment between logo, nav, and footer controls.

## Implementation plan

1. **Repair injury persistence at the source**
   - Add a database migration to replace `players_injury_check` with a constraint that accepts normalized app health codes: `OUT`, `Q`, `DTD`, `GTD`, `PROB`.
   - Update `supabase/functions/nba-injury-report/index.ts` so it writes only the normalized code to `players.injury`, never rich labels like `Out — Calf`.
   - Preserve rich details without breaking the constraint by keeping them in the injury report response and, where safe, in `players.note` only if needed and non-destructive.
   - Return accurate persistence stats: matched players, changed rows, cleared rows, and update errors.

2. **Make app queries immediately reflect injury updates**
   - Ensure `players-list`, `player-detail`, and roster fallback data expose `core.injury` consistently in addition to `flags.injury`, because several UI paths read `core.injury`.
   - Keep health normalization centralized through `src/lib/health.ts`; no direct UI should depend on raw injury labels as the primary source.

3. **Unify played-game modal behavior**
   - Use `GameDetailModal` as the canonical played-game modal for roster game slots and Player Modal history clicks.
   - Remove or stop using the older Player Modal “Game Box Score” dialog path for game-level opening, keeping player click-through behavior via the shared box score table.
   - Enrich `player-detail` history rows with `game_boxscore_url`, `game_charts_url`, `game_playbyplay_url`, `game_recap_url`, `youtube_recap_id`, and `tipoff_utc` from `schedule_games`.
   - Extend `GameDetailModal` so recap embed works from either `youtube_recap_id` or a YouTube URL, while NBA.com recap links remain external when no YouTube ID exists.
   - Add `youtube_recap_id` to the frontend game types and schedule hooks used by roster slots and schedule previews.

4. **Fix roster header icon polish**
   - Change Quick Actions from amber/yellow to a theme-safe distinct color with a clear hover state in both light and dark themes.
   - Swap Ballers.IQ wordmark asset usage so the light and dark theme PNGs are reversed as requested, keeping the transparent pill and hover surge.
   - Keep Reset unchanged except for existing destructive styling and no surge.

5. **Fix collapsed sidebar alignment for real**
   - Refactor collapsed sidebar structure so the logo, nav icons, sign-out, theme, and expand controls all use the same fixed-width centered rail.
   - Remove the residual left/right padding and active/hover offset effects only in collapsed mode.
   - Increase vertical spacing between collapsed nav icons while preserving the existing expanded sidebar look.

6. **Validation**
   - Read back Aaron Gordon from Supabase after the migration/function change to confirm `players.injury = 'OUT'` can persist.
   - Call or inspect the injury Edge Function logs to confirm update errors are gone.
   - Verify the two example games (`SAS at DEN`, `PHI at SAS`) carry recap video IDs/links into the shared modal.
   - Run targeted checks for TypeScript/import issues through the normal harness, and use browser/preview inspection for collapsed sidebar alignment and modal behavior.

## Files expected to change

- `supabase/functions/nba-injury-report/index.ts`
- `supabase/functions/player-detail/index.ts`
- Supabase migration for `players_injury_check`
- `src/lib/contracts.ts`
- `src/components/GameDetailModal.tsx`
- `src/components/PlayerModal.tsx`
- `src/hooks/useUpcomingByTeam.ts`
- `src/hooks/useScheduleWeekGames.ts`
- `src/hooks/useStandingsContext.ts`
- `src/pages/RosterPage.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/index.css`

<lov-actions>
<lov-open-history>View History</lov-open-history>
<lov-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</lov-link>
</lov-actions>