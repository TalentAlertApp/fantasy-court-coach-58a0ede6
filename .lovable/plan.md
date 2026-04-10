

## Import Schedule TSV and Wire URL Fields

### What exists today
- `schedule_games` table already has columns: `nba_game_url`, `game_recap_url`, `game_boxscore_url`, `game_charts_url`, `game_playbyplay_url` — but all URL columns except `nba_game_url` are currently NULL.
- The `schedule` edge function only returns `nba_game_url` to the frontend; the other 4 URL fields are ignored.
- `ScheduleGameSchema` in contracts.ts only includes `nba_game_url`.
- The existing "Import Game Data" tool on `/commissioner` is designed for player game logs + schedule combined — not suitable for a clean schedule-only replace.

### Plan

**1. New edge function: `import-schedule`**
- Accepts `{ rows: [...], replace: boolean }`.
- Each row: `{ gw, day, date, dayName, time, home_team, away_team, status, home_pts, away_pts, game_id, nba_game_url, game_recap_url, game_boxscore_url, game_charts_url, game_playbyplay_url }`.
- If `replace` is true, deletes all rows from `schedule_games` first.
- Upserts all rows into `schedule_games` on `game_id`.
- Builds `tipoff_utc` from date + time (DD/MM/YYYY or YYYY-MM-DD + HH:MM).
- Normalizes status (Final → FINAL, etc.).
- Returns count of games imported.

**2. Commissioner page: new "Import Schedule" card**
- New section with file picker for `.tsv` files.
- Parses TSV with header: `Week, Day, Date, Day Name, Time, Home Team, Away Team, Status, Home Score, Away Score, Game ID, Game URL, Game Recap, Game BoxScore, Game Charts, Game Play_By_Play`.
- Maps columns by header name (not index) for robustness.
- Full replace toggle (ON by default).
- Calls the new `import-schedule` edge function.
- Shows result count.

**3. Wire URL fields through the stack**
- **`ScheduleGameSchema`** (contracts.ts): Add `game_recap_url`, `game_boxscore_url`, `game_charts_url`, `game_playbyplay_url` as `z.string().nullable()`. Remove `.strict()` or add the fields.
- **`schedule` edge function**: Include all 5 URL fields in the response mapping.
- **`ScheduleList.tsx`**: The external link icon already uses `nba_game_url`. No immediate UI change needed for the other URLs — they'll be available in the data for future use (box score links, recap links, etc.).

**4. Contract + API glue**
- Add `ImportScheduleResponseSchema` to contracts.ts.
- Add `importSchedule()` function to `api.ts`.

### Files changed
| File | Action |
|------|--------|
| `supabase/functions/import-schedule/index.ts` | New edge function for schedule-only import |
| `supabase/functions/schedule/index.ts` | Return all 5 URL fields in response |
| `src/lib/contracts.ts` | Add URL fields to `ScheduleGameSchema`, add `ImportScheduleResponseSchema` |
| `src/lib/api.ts` | Add `importSchedule()` |
| `src/pages/CommissionerPage.tsx` | Add "Import Schedule" card with TSV parser |

