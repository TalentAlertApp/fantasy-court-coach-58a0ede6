

## Fix Player Modal: Season vs Last5, History & Schedule Tabs

### Problems

1. **Season FP/G = Last 5 FP/G**: The `player-detail` function reads pre-computed `fp_pg_t` and `fp_pg5` from the `players` table, but those aren't updated when game data is imported. Solution: compute both from `player_game_logs` in the edge function.

2. **History tab is bare**: Just shows "date vs opp → FP". Reference (fantasynba.com) shows a rich stats table with columns: GD (e.g. GW20.6), OPP (logo + score), PTS, MP, PS, R, A, B, S. Each row should be clickable to open that game's box score.

3. **Schedule tab is bare**: Just shows "away @ home → status". Reference shows: Game date, GD (Gameweek X - Day Y), Opponent (logo + vs/@ team). Should show all upcoming gameweek-days for the player's team.

---

### Changes

#### 1. Edge function `player-detail/index.ts`

**Compute season & last5 from game logs:**
- Fetch ALL game logs for the player (no limit)
- Season averages = mean of all logs
- Last 5 averages = mean of most recent 5 logs
- Override `player.season.fp` and `player.last5.fp5` (and other per-game stats) with computed values
- Also recompute `computed.value` and `computed.value5` (fp / salary)
- Set `player.season.gp` = total game logs count

**Enrich history items:**
- Join each log's `game_id` with `schedule_games` to get `gw`, `day`, `home_pts`, `away_pts`, `home_team`, `away_team`
- Return all logs (increase limit to 100)
- Add fields: `game_id`, `gw`, `day`, `home_pts`, `away_pts`, `home_team`, `away_team`

**Enrich upcoming/schedule:**
- Fetch ALL `schedule_games` for the player's team (not just SCHEDULED), ordered by tipoff
- Add `gw`, `day` to each item

#### 2. Contract updates `src/lib/contracts.ts`

**PlayerHistoryItemSchema** — add:
- `game_id: z.string()`
- `gw: IntSchema`
- `day: IntSchema`
- `home_pts: IntSchema`
- `away_pts: IntSchema`
- `home_team: z.string()`
- `away_team: z.string()`

**PlayerUpcomingItemSchema** — add:
- `gw: IntSchema`
- `day: IntSchema`

#### 3. UI `src/components/PlayerModal.tsx`

**History tab** — redesign to match fantasynba.com:
- Header: "This Season"
- Table columns: GD | OPP | PTS | MP | PS | R | A | B | S
- GD = `GW{gw}.{day}` (bold)
- OPP = team logo + `vs.OPP score - score` or `@OPP score - score`
- PTS = fantasy points (bold)
- Each row clickable → opens game box score in a nested dialog or navigates to /schedule
- Increase max-height for scrollable area

**Schedule tab** — redesign to match fantasynba.com:
- Table columns: Game date | GD | Opponent
- Game date = formatted date + time from `tipoff_utc`
- GD = `Gameweek {gw} - Day {day}`
- Opponent = team logo + `vs.TEAM` or `@TEAM`
- Show dash `-` for days without games

---

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/player-detail/index.ts` | Compute season/last5 from logs; enrich history & upcoming with game details |
| `src/lib/contracts.ts` | Add `game_id`, `gw`, `day`, scores to history; add `gw`, `day` to upcoming |
| `src/components/PlayerModal.tsx` | Redesign History and Schedule tabs to match fantasynba.com layout |

