I found the core issue: the database imports look structurally fine, but several client-side pages still use NBA-only constants/queries or NBA regular-season assumptions. In WNBA mode, those NBA-only parts either show NBA teams/games or filter WNBA players out because WNBA preseason stats have GP = 0.

Plan:

1. Add a small league/team metadata adapter
- Create a reusable helper that returns the active league's team list, logo, display name, primary color, conference, and venue image.
- Use NBA metadata in NBA mode and `WNBA_TEAMS` in WNBA mode.
- This will prevent individual pages from importing `NBA_TEAMS` directly when they should be league-aware.

2. Fix `/my-roster` header and schedule wiring
- Replace hardcoded `getCurrentGameday()` usage with `useLeagueDeadlines()` + `getCurrentGamedayFrom()` so WNBA rosters use WNBA GW/day deadlines.
- Pass the active GW into `RosterCourtView` and `RosterListView` instead of those components computing NBA GW internally.
- Replace the list-view NBA watermark with the active league logo.
- Ensure roster schedule slots resolve against the active league’s `schedule_games` only.

3. Fix `/transactions` player availability and team filter
- Remove the `p.season.gp > 0` filter when the active league is WNBA/preseason, so WNBA players with GP = 0 still appear as trade/add options.
- Make the Team filter use WNBA teams in WNBA mode instead of NBA teams.
- Reset invalid selected team filters on league switch, so a stale NBA team filter cannot hide the WNBA market.
- Replace NBA Fantasy branding/logo in the filter panel with the active league logo.

4. Fix `/teams` all tabs for WNBA
- Scope direct Supabase queries on `schedule_games`, `player_game_logs`, and `players` by active `league_id`.
- Build team cards from WNBA metadata in WNBA mode and NBA metadata in NBA mode.
- Update heading/logo labels from “NBA Teams” to active league.
- Update standings calculation to work with the active team list and WNBA East/West conferences. For WNBA, the division view will gracefully fall back to conference/league grouping because WNBA has no NBA-style divisions.
- Ensure Team modal opened from `/teams` also scopes schedule/roster queries to active league and uses the correct compare-team list.

5. Fix `/schedule` WNBA venue images and logos
- Add venue-image resolution for WNBA home teams using `src/lib/wnba-teams.ts`.
- Update `ScheduleList` game cards to use the active league logo helper and WNBA home venue image when in WNBA mode.
- Keep existing NBA venue behavior unchanged.

6. Fix `/advanced` WNBA wiring
- Rename/parameterize the NBA Play Search UI so the selected league is visible.
- Scope BY GAME `schedule_games` queries by active `league_id` so only WNBA games appear in WNBA mode.
- Use league-specific deadlines/GW/day lists for WNBA instead of static NBA `DEADLINES`.
- Use active league team names/logos in the game picker.
- Update `usePlayingTimeTrends` to filter `player_game_logs` and `players` by active `league_id`, so Playing Time Trends does not show NBA rows in WNBA mode. If WNBA has no logs yet, it will show a clean “No data available” state rather than NBA players.

7. Verification after implementation
- Query/check the DB counts for WNBA teams, players, schedule again.
- Use read-only API/function checks where possible to confirm `players-list`, `schedule`, roster-current, and transactions market inputs return WNBA-scoped data.
- Inspect the affected routes in the preview: `/my-roster`, `/transactions`, `/teams`, `/schedule`, and `/advanced` with WNBA selected.

Notes:
- The empty `/transactions` list is very likely caused by the `season.gp > 0` UI filter. Your WNBA players currently have `gp_positive = 0`, which is expected in preseason, so the page filters all 255 WNBA players out.
- The mixed game dropdown in `/advanced` is caused by a direct `schedule_games` query missing `.eq('league_id', activeLeagueId)`.
- The NBA team filter in `/transactions` is caused by `FiltersPanel` importing `NBA_TEAMS` directly.