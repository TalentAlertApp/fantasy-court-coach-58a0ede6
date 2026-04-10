

## Plan: Insert GW1 Game Data + Enhance Box Score UI

### Task 1: Insert GW1 Day 1 game data via script

Two games need inserting into `schedule_games` and `player_game_logs`:

- **OKC @ HOU** — Game ID `2250001`, Oct 21 2025, 19:00 Lisbon (18:00 UTC, since Oct = WEST/UTC+1), Final 125-124
- **GSW @ LAL** — Game ID `2250002`, Oct 21 2025, 22:30 Lisbon (21:30 UTC), Final 119-109

Wait — the data shows `LAL @ GSW` (LAL away, GSW home) for the second game based on the column order (Home=GSW, Away=LAL). And for game 1: Home=OKC, Away=HOU.

Actually looking at the data more carefully: columns are `Week Day Date DayName Time HomeTeam AwayTeam HomeScore AwayScore Status GameID ID Player PTS MP PS R A B S`

Game 1: Home=OKC, Away=HOU, 125-124, game_id=2250001
Game 2: Home=GSW, Away=LAL, 119-109, game_id=2250002

I'll run a script to:
1. Upsert 2 rows into `schedule_games` (gw=1, day=1)
2. Upsert ~28 rows into `player_game_logs`
3. Update `player_last_game` for these players

### Task 2: Add team abbreviation to box score rows

- **Edge function** (`game-boxscore/index.ts`): Add `team` to the player select query (`id, name, fc_bc, photo, team`) and include it in the response
- **Contract** (`contracts.ts`): Add `team: z.string()` to `GameBoxscorePlayerSchema`
- **Component** (`ScheduleList.tsx`): Display team abbreviation after the player name as a muted text span

### Task 3: Sortable stat columns in box score

- Add `sortKey` and `sortDir` state to `GameBoxScore` component
- Make header cells clickable with sort indicators (▲/▼)
- Sort the players array by the selected column before rendering
- Default sort: FP descending (matches current behavior)

### Files changed
| File | Action |
|------|--------|
| Script (one-off) | Insert 2 schedule_games + ~28 player_game_logs for GW1 Day 1 |
| `supabase/functions/game-boxscore/index.ts` | Add `team` field to response |
| `src/lib/contracts.ts` | Add `team` to `GameBoxscorePlayerSchema` |
| `src/components/ScheduleList.tsx` | Show team abbr after name + sortable column headers |

