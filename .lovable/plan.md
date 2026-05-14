## Diagnosis

The failures share one pattern: the app is mixing two different concepts of “league”:

- **Fantasy leagues**: Main League NBA/WNBA and custom fantasy leagues.
- **Sport leagues**: the actual NBA/WNBA data rows that own `players`, `schedule_games`, and `player_game_logs`.

The database confirms all player/schedule/log data lives under sport leagues (`code='nba'`, `code='wnba'`), while fantasy Main League rows intentionally have zero schedule/player rows. Several frontend queries and state transitions still sometimes resolve/use the fantasy league ID or stale NBA cache, which explains:

- roster gameweek slots empty,
- team modal empty,
- `/teams` games/players/standings empty,
- `/leagues` missing system Main Leagues,
- scheduled game cards not opening the expected detail view,
- WNBA cards showing NBA player blurbs.

## Plan

1. **Centralize active sport resolution**
   - Make the selected team’s `sport_league_id/league_code` the app-wide source of truth when a team is selected.
   - Ensure WNBA teams created under the old NBA Main League fantasy row still activate WNBA data correctly.
   - Invalidate/refetch all sport-scoped caches when active sport or selected team changes.

2. **Fix sport league ID lookup everywhere**
   - Keep `useLeagueId()` resolving only `leagues.kind='sport'` and `code IN ('nba','wnba')`.
   - Add league/sport to all direct Supabase query keys that read `players`, `schedule_games`, or `player_game_logs`.
   - Remove remaining query keys that only use generic names like `['players', {limit:1000}]` without the active sport.

3. **Fix roster gameweek slots**
   - Query the full current gameweek from `schedule_games` by active sport league ID, not a rolling date window.
   - Build `upcomingByTeam` from the current league’s gameweek rows, including final and scheduled games.
   - This will populate the circular opponent slots for both NBA and WNBA rosters.

4. **Fix Team modal and `/teams`**
   - Ensure Team modal games, roster, and player-log aggregation are filtered by the active sport league ID.
   - Ensure `/teams` schedule counts, active players, and standings all use sport league ID and never a fantasy league ID.
   - Keep WNBA/NBA team metadata separated so logos and names match the active sport.

5. **Fix `/leagues` Main League visibility**
   - Adjust the fantasy league fetch logic so both system Main Leagues (`MAIN_LEAGUE_NBA_ID`, `MAIN_LEAGUE_WNBA_ID`) are always included in My Leagues for authenticated users.
   - If RLS is hiding private system rows from the browser query, add a safe read policy that exposes only system Main League metadata, not user-private data.

6. **Fix schedule card behavior and WNBA player blurbs**
   - Make scheduled game cards open the same detail modal path as played games, instead of only expanding inline previews.
   - Scope scheduled “players to watch” fetches by active league in the query key and request path, preventing stale NBA `players` cache from being used on WNBA schedules.
   - Scope `game-boxscore` queries by active league and pass/attach `league_code` so duplicate or ambiguous game IDs cannot mix sports.

7. **Validate**
   - Use Supabase read checks and edge-function calls to verify NBA/WNBA sport IDs return non-empty schedule/player/log counts.
   - Verify the affected flows in preview: switching header team between NBA/WNBA updates `/`, `/teams`, `/leagues`, `/schedule`, and scheduled WNBA cards no longer show NBA players.

## Files likely to change

- `src/contexts/TeamContext.tsx`
- `src/contexts/LeagueContext.tsx`
- `src/hooks/useLeagueId.ts`
- `src/hooks/useUpcomingByTeam.ts`
- `src/components/ScheduleList.tsx`
- `src/components/TeamModal.tsx`
- `src/pages/TeamsPage.tsx`
- `src/pages/LeaguesPage.tsx`
- `src/hooks/useFantasyLeagues.ts`
- `src/hooks/useGameBoxscoreQuery.ts`
- `src/lib/api.ts`
- Possibly one Supabase RLS migration for system Main League visibility if the current browser policy is confirmed to hide those rows.