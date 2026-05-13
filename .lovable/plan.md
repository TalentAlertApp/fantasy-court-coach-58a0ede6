## Issues to fix

### 1. Game Scheduled modal & Compare Teams modal show empty content
**Files:** `src/components/NBAGameModal.tsx` (Game Scheduled, opened from TeamModal → UPCOMING), `src/components/TeamCompareModal.tsx`.
**Cause:** When a game has `status='scheduled'`, the panels (Standings & Form, BoxScore, Charts) render empty placeholders without a fallback. The Compare modal "Standings & Form" panel renders blank when standings haven't loaded for the matchup teams.
**Fix:** 
- In NBAGameModal/Compare modal: detect `scheduled` games and render a "Pre-game preview" block (matchup form last 5, head-to-head, venue, tipoff) instead of empty boxscore container.
- In TeamCompareModal: render the standings rows + form pills even when one side has 0 games yet (show "—"/"No games yet" placeholders). Ensure the panel has a non-empty default state.

### 2. Step 6 (Chips & Transfers) and Step 4 (Roster Rules) — vertical density
**File:** `src/pages/CreateLeaguePage.tsx`.
- Step 4: put **Budget cap**, **Bench size**, and **Max players per team** in a 3-column grid (md+) instead of stacked full-width rows. Reduce vertical padding.
- Step 6: place the four chip rows (Captain / Wildcard / All-Star / Free transfers) into a 2-column grid at md+ with tighter padding. Inline the multiplier/per-season inputs on the same row as the toggle.

### 3. Step 1 BACK button → /leagues
**File:** `src/pages/CreateLeaguePage.tsx`.
- The BACK button is currently disabled on step 1. Change behavior: on step 1, BACK navigates to `/leagues` instead of being disabled.

### 4. CREATE TEAM from /leagues lands on /roster instead of a team-creation flow
**File:** `src/pages/LeaguesPage.tsx` (`handleCreateTeam`).
- Currently navigates to `/welcome` (onboarding). For Main Leagues we should route to a real team-creation entry point. Use `/welcome` with state `{ leagueId, sport, forceCreate: true }` AND, in `OnboardingPage`/`TeamPickerPage`, honor `forceCreate` so the user lands on the name+draft flow even if they already have teams. Alternatively (simpler): route to `/teams?create=1&league=<id>` and have TeamsPage open the "New Team" creation directly.
- I'll go with the simpler route: navigate to `/teams?create=1&league_id=<id>` and trigger the existing "+ New Team" modal on mount.

### 5 & 6. Main League "Open" loads wrong team / dropdown shows 0 teams for the other sport
**Files:** `src/contexts/TeamContext.tsx`, `src/contexts/FantasyLeagueContext.tsx`, `src/hooks/useLeagueTeams.ts` (or the team-list query).
**Cause:** Teams are scoped to the `leagues.id` of the **sport** league (NBA sport league id / WNBA sport league id), but the team-switcher and `/scoring` filter teams by the **fantasy** league id (Main League NBA/WNBA fantasy ids). The two id namespaces don't match, so:
- WNBA Main League shows "0 teams" while the NBA sport teams exist.
- Opening NBA Main League doesn't reset the active team because `TeamContext` doesn't auto-switch when the fantasy league changes.

**Fix:**
- Add a `sportCodeFor(fantasyLeagueId)` resolver via the league row's `sport` column (already present).
- In TeamContext, filter teams by **sport** (`teams.league.code === selectedFantasyLeague.sport`) rather than by fantasy league id, OR by `team.fantasy_league_id` if/when present. For Main Leagues, the source-of-truth is the team's sport.
- When `setSelectedLeagueId` changes the fantasy league sport, reconcile `selectedTeamId` to the first team belonging to that sport (mirrors the existing fallback pattern).
- Result: opening NBA Main League switches the active team to an NBA team; dropdown lists 4 NBA teams under NBA Main, 0 under WNBA Main correctly.

### 7. /roster — remove SEASON CHIPS card; surface badge on header icon
**Files:** `src/pages/RosterPage.tsx`, `src/components/RosterChipsBar.tsx`, the header where the Season Chips icon lives (likely `RosterPage` header).
- Delete the SEASON CHIPS card render.
- On the page-header sparkles/chips icon, add a small dot/count badge in the top-right when chips are active (Wildcard available or All-Star Boost active).
- Restore court/table to their original vertical position (no extra spacing left over).

### 8. After WILDCARD activation, /transactions left "MY ROSTER" pane is empty
**Files:** `src/components/transactions/RosterPane.tsx`, `src/pages/TransactionsPage` (or wherever wildcard mode is toggled), and the roster query hook.
**Cause:** Activating Wildcard changes the working roster to an "empty/blank" mode for transfer planning, but the left pane reads from the active roster query which is now in wildcard-mode-empty state. We need to keep showing the **current locked-in roster** on the left as the baseline while the workbench operates on the wildcard draft on the right.
**Fix:**
- Snapshot the pre-wildcard roster into a memo and pass it to `RosterPane` independent of the wildcard buffer.
- Ensure `useRosterQuery` is not invalidated to empty when wildcard activates; the wildcard state lives in the workbench/local state only.

---

## Technical notes
- `MAIN_LEAGUE_NBA_ID` / `MAIN_LEAGUE_WNBA_ID` already exist in `useFantasyLeagues.ts`; reuse them.
- The fantasy league row carries a `sport` field (`'nba'|'wnba'`) — use it to map fantasy league → team sport for filtering and reconciliation.
- No DB migration required; this is all client + minor edge-function-free logic.
- Keep all changes UI/state only; do not touch scoring/roster business logic.