## Plan: 3 fixes (Player modal schedule, /leagues filter, /scoring WNBA standings + selector snap-back)

### 1. PlayerModal — wire scheduled games to the Game Detail modal

In `src/components/PlayerModal.tsx`, the `Schedule` tab currently renders upcoming rows as inert `<TableRow>`s. Reuse the same pattern already wired in `src/components/TeamModal.tsx` (Upcoming tab → `GameDetailModal` with a built `GameDetailGame` object including `played: false`).

- Add `selectedGame` state (already imported `GameDetailModal` + `GameDetailGame`).
- Wrap each upcoming row in a button (or add `onClick` to the `TableRow`) that builds the same `GameDetailGame` payload used in `TeamModal` (game_id, home/away, scores 0, status, all url fields, `youtube_recap_id`, gw, day, tipoff, `played:false`) from `data.upcoming[i]`.
- Render `<GameDetailModal game={selectedGame} open={!!selectedGame} onOpenChange={(o)=>!o && setSelectedGame(null)}/>` next to the existing `GameDetailModal` already used in the Played tab. Keep the played-game flow untouched.

No styling changes beyond hover affordance to match Played tab.

### 2. /leagues — add the same filter bar to the "My Leagues" tab

In `src/pages/LeaguesPage.tsx`, extract the `DiscoverPanel` filter row (sport pills with All/NBA/WNBA logos, search input + button, sort `Select`) into a small inline component reused by both tabs, OR copy the same JSX into the `mine` tab.

State for "mine" tab (local to the page component):
- `mineSport: "all" | "nba" | "wnba"` (default `"all"`).
- `mineSearchInput`, `mineSearch` (apply on Enter / Search button).
- `mineSort: "active" | "newest" | "name"` — default `"active"`.

Filter pipeline applied to `sortedLeagues` for rendering:
- Sport: `mineSport === "all" || l.sport === mineSport`.
- Search: case-insensitive substring on `l.name`.
- Sort: `active` keeps current ordering (Main NBA, Main WNBA, then custom A→Z); `newest` by `created_at` desc; `name` A→Z.

The empty-state ("Create your first league") still renders only when `myCustom.length === 0` after filtering returns 0 AND the user has no custom leagues; otherwise show a small "No leagues match these filters" line.

Visual: identical bar (same classes, same logo treatment, same `Search` + `Select` widgets) shown above the list/cards grid. Both `mine` and `discover` tabs keep the existing list/cards view toggle in the header.

### 3. /scoring — fix WNBA Main standings and league selector "snap-back"

Two underlying causes:

A. **TeamContext snaps the active fantasy league back to match the selected team's sport.** In `src/contexts/TeamContext.tsx`, the effect "Reconcile fantasy league when the active team's sport diverges from it" runs on every league change too. When the user picks NBA Main (or any NBA league) while a WNBA team is active, this effect immediately flips the league back to WNBA Main, so the selector visually snaps back. Same when picking WNBA Main while on an NBA team.

B. **`league-standings` edge function returns 0 rows for WNBA Main.** In the DB every team has `teams.league_id = '...0010'` (NBA Main pseudo-id) regardless of sport; only `sport_league_id` discriminates NBA vs WNBA. `get_league_teams(_league_id='...0020')` therefore returns no rows for WNBA Main.

Fix — keep player/team/roster/schedule logic untouched (LeagueContext still derives `league` from `selectedTeam.league_code`):

1. **Invert the reconciliation in `TeamContext`.** When the user changes the *fantasy league* (selector), switch the *team* to a team in that league/sport instead of switching the league. Concretely:
   - Drop the existing "Reconcile fantasy league when active team's sport diverges" effect (which calls `setSelectedLeagueId`).
   - Strengthen the existing "When the active fantasy league changes, if the currently selected team isn't in that league, switch to the first team that is" effect: remove the early-return `if (selectedLeague.sport !== teamSport) return;`. Instead, compute the ordered candidate set:
     1. Teams in `teamsInSelectedLeague`.
     2. Else any team whose `league_code` matches `selectedLeague.sport`.
     3. Else any team (last resort).
     Pick the first non-empty group, set `selectedTeamId`, persist to localStorage, invalidate all queries.
   - The header pill (`HeaderTeamPill` / `TeamSwitcher`) continues to be authoritative for the active sport going the *other* direction: when the user clicks a team in the pill, the existing `setSelectedTeamId` flow stays unchanged. Add a paired effect in `TeamContext` that, when `selectedTeam.league_code` changes via that path, snaps the fantasy league to the matching Main League ONLY IF the current `selectedLeague.sport !== teamSport` AND the change originated from the team pill (track this with a ref: set `lastChangeOriginRef.current = "team"` in `setSelectedTeamId`, `"league"` in a wrapper around the league selector callback exported through context, default `"team"`).
   - Net behaviour:
     - User picks WNBA Main from `/scoring` selector → league sticks to WNBA Main; selected team is auto-switched to a WNBA team if available; sidebar pill follows the team change.
     - User picks NBA team from sidebar pill → fantasy league snaps to a matching-sport league (existing behaviour preserved for roster/schedule).

2. **Fix `supabase/functions/league-standings/index.ts` to handle Main Leagues by sport.** When the requested `leagueId` is one of the two Main League pseudo-ids (`'...0010'` or `'...0020'`), bypass `get_league_teams(_league_id)` and instead select teams directly from `teams` filtered by `sport_league_id = <resolved sport_league_id for that Main League's sport>`, joining `auth.users` for `owner_label` (mirror the SQL the RPC already runs: `select id, name, owner_id, split_part(coalesce(u.email,'user'),'@',1) as owner_label`). The rest of the pipeline (rules, schedule_games filter by `sportLeagueId`, scoring, summary) is unchanged. Result: WNBA Main standings populate from all teams whose `sport_league_id` matches the WNBA sport row, regardless of which Main League pseudo-id is stored on `teams.league_id`.

3. **Sidebar `TeamSwitcher` consistency.** Today it shows `teamsInSelectedLeague.length ? teamsInSelectedLeague : teams`, which is why a custom WNBA league with zero teams falls back to all teams (mixing NBA in). Constrain the fallback to `teams.filter(t => (t.league_code ?? "nba") === selectedLeague.sport)` so an empty WNBA custom league shows only WNBA teams, matching the WNBA Main behaviour. If that filtered set is also empty, then fall back to all teams.

### Files to change

- `src/components/PlayerModal.tsx` — Schedule tab rows clickable + `GameDetailModal` instance.
- `src/pages/LeaguesPage.tsx` — filter bar on `mine` tab + sport/search/sort state and pipeline.
- `src/contexts/TeamContext.tsx` — invert reconciliation; track origin of last change.
- `src/components/TeamSwitcher.tsx` — sport-scoped fallback.
- `supabase/functions/league-standings/index.ts` — Main League branch resolves teams by `sport_league_id`.

### Out of scope / unchanged

- LeagueContext, `useRosterQuery`, `useScheduleWeekGames`, `useUpcomingByTeam`, `usePlayersQuery` and all roster/schedule/players paths.
- Court Show, search diacritics, and other prior fixes.
- DB schema and RLS (no migration needed; backfilling `teams.league_id` for WNBA teams is intentionally avoided to keep current ingest paths intact).
