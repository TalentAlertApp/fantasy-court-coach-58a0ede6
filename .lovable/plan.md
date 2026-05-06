## Goal

Three fixes so WNBA mode works end-to-end: (1) show team rosters even with no game logs, (2) make the game-detail popup league-aware with venue watermark, (3) make `/schedule` cards/previews use WNBA logos, venues and labels when the active team is WNBA.

---

## 1. Empty rosters at `/teams` and TeamModal → Roster

WNBA is preseason, so `player_game_logs` is empty. Both surfaces filter players by `gp > 0` and end up with nothing.

**`src/pages/TeamsPage.tsx`** — `playerCounts` query: count from `players` (already league-scoped), not from `player_game_logs`. Group by `team` and produce the same `Record<string, number>`. This lights up the "N players" pills (15 ATL, 19 CHI, …).

**`src/components/TeamModal.tsx`** — `team-roster-agg` query: keep the `players` fetch league-scoped, fetch logs as today, but **do not drop players with `gp === 0`**. Show all team players with `mpg/ppg/fpg = 0` when no logs exist. Tab title `Roster (N)` then shows the real squad size in WNBA.

## 2. League-aware Game Detail popup (used by `/schedule` AND `/` My Roster)

**`src/components/GameDetailModal.tsx`**
- Replace `getTeamLogo(...)` with league-aware lookup via `useLeagueTeams()` (find by tricode → logo).
- Watermark in `GameBoxScoreTable`: switch `nbaLogo` → `wnbaLogo` when `useLeague()` is `wnba`.
- Replace the `NBA` action chip label and "Watch Recap on NBA.com" copy with neutral text driven by league: `WNBA` / "Watch Recap on WNBA.com" in WNBA mode (NBA labels stay in NBA mode).
- Add a venue watermark behind the header strip: lookup `getVenue(game.home_team)` (already WNBA-aware via `WNBA_TEAMS` fallback) and render `venue.image` as a soft full-bleed background (opacity ~0.18 light / 0.28 dark) under the existing gradient.

## 3. `/schedule` game cards and previews wired to WNBA

**`src/components/ScheduleList.tsx`**
- Replace direct `getTeamLogo` calls with a local `logoFor(tricode)` helper backed by `useLeagueTeams()` so `away_team`/`home_team` resolve to WNBA logos in WNBA mode.
- `useAllTeamsForm` (used only by the inline "Last 5" preview): scope the `schedule_games` query by `league_id` from `useLeagueId()` and key on `["all-teams-form", leagueId]`. Replace `NBA_TEAM_META` reads with `useLeagueTeams()` for conference grouping (use `team.conference` from `LeagueTeam`; fall back to existing meta when null = NBA).
- Action chips and recap links: rename hardcoded "NBA"/"NBA.com" copy to "WNBA"/"WNBA.com" when in WNBA mode (single conditional).
- Venue background already works because `getVenue` falls back to WNBA — leave unchanged.

**`src/components/SchedulePreviewPanel.tsx`**
- Same `logoFor` swap. `primaryByTeam` map: build from `useLeagueTeams()` instead of `NBA_TEAMS`.

## Verification

- `/teams` (WNBA): cards show real player counts (e.g. 15, 19, 21…). Click a team → Roster tab shows full WNBA squad with zeros, not blank.
- `/schedule` (WNBA): away/home logos render WNBA badges; click a game → modal shows WNBA logos, WNBA venue watermark, "WNBA.com" labels.
- `/` My Roster (WNBA): clicking a starter's upcoming opponent slot opens the same league-aware popup with the correct venue + logos.
- NBA mode regression: NBA cards, logos and "NBA.com" labels unchanged.
