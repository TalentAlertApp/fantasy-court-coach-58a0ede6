## Problem

`HeaderTeamPill` switches `selectedTeamId`, and `/` (My Roster) updates because it queries by team id. But every other page (`/transactions`, `/teams`, `/schedule`, `/advanced`, `/leagues`) reads the league from `useLeague()`, which derives `league` from the **selected fantasy league's sport**, not the selected team:

```ts
// src/contexts/LeagueContext.tsx
const league = selectedLeague && selectedLeague.id !== MAIN_LEAGUE
  ? sportCode                       // WNBA Invitational → "wnba", stays "wnba"
  : (selectedTeam?.league_code === "wnba" ? "wnba" : "nba");
```

So when the user is in a WNBA fantasy league and picks an NBA team in the header, `league` stays `"wnba"` → Players, Teams, Schedule, Advanced all keep loading WNBA data.

`TeamContext` has the inverse coupling (changing fantasy league auto-switches team to one in that league) but there is no team→league reconciliation.

## Fix

Add the missing direction: **when the active team's sport doesn't match the active fantasy league's sport, auto-switch the fantasy league** to one that matches the team. The header pill stays the single source of truth for "which sport am I looking at".

### Selection rule (in `TeamContext`, after team change)

When `selectedTeam.league_code` ≠ `selectedLeague.sport`:
1. Prefer a fantasy league the user owns/belongs to whose `sport === selectedTeam.league_code` AND that contains this team (`team.league_id === league.id`).
2. Else prefer any accessible fantasy league with matching sport.
3. Else fall back to the system Main League of that sport (`MAIN_LEAGUE_ID` for NBA, the WNBA main league id for WNBA — both already exist in `useFantasyLeagues`).

Call `setSelectedLeagueId(...)` from `FantasyLeagueContext` so all league-scoped query caches invalidate (already wired).

### Where the change goes

- **`src/contexts/TeamContext.tsx`** — add a `useEffect` that watches `selectedTeam?.league_code` and `selectedLeague?.sport`; when they diverge, resolve the target fantasy league per the rule above and call `setSelectedLeagueId`.
- No change needed in `LeagueContext` — once the fantasy league switches, `sportCode` flips and `currentLeague` is invalidated (existing code wipes all React Query caches on league change).
- No page-level changes needed: every affected page already reads `useLeague()` / `usePlayersQuery` / `useScheduleQuery` / `useLeagueTeams` which all key on `league`.

### Edge cases

- **Main League selected** (mixed-sport pseudo league): already falls through to `selectedTeam.league_code` in `LeagueContext` — no reconciliation needed, leave as-is.
- **User has no matching fantasy league** for the new team's sport: fall back to that sport's Main League (always accessible).
- **Initial load**: only run reconciliation after `isReady && !fantasyLeagueIsLoading` so we don't fight the auto-correct that picks a populated team.
- **Loop guard**: only trigger when sports actually differ; setting the fantasy league then triggers `TeamContext`'s existing "switch team to one in this league" effect — but since the team we just selected IS in the new league (rule #1) or matches its sport, that effect will be a no-op.

### Files to edit

- `src/contexts/TeamContext.tsx` (one new effect, ~20 lines)

### Verification

1. Start in WNBA Invitational with a WNBA team → switch header to an NBA team → `/transactions`, `/teams`, `/schedule`, `/advanced`, `/leagues` all flip to NBA data.
2. Switch back to WNBA team → all pages flip back to WNBA.
3. Main League stays mixed and follows the team directly (current behavior preserved).
