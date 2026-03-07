
Goal: make finished games appear on `/schedule` and simplify nav controls per your request.

What I found
- `schedule` page reads only from `schedule_games` (not from `games`).
- Current DB confirms `schedule_games` only has GW 21–25 (254 rows), so GW20 returns empty.
- In `sync-sheet`, `syncSchedule()` still filters rows with `gameId && !playerId`; your finished rows in FP have `playerId`, so they are excluded.
- This matches your screenshot (finished rows are player-stat rows).

Implementation plan

1) Fix schedule ingestion to include finished game rows
- File: `supabase/functions/sync-sheet/index.ts`
- Update `syncSchedule()` row filter:
  - From: `gameId && !playerId`
  - To: include all rows with valid `gameId` (+ valid week/day), regardless of `playerId`.
- Keep de-dup by `game_id` (`seen` set) so one schedule row is produced per game even if many player rows exist.
- Keep score mapping (`home_pts`, `away_pts`) from sheet columns H/I.
- Keep status mapping, but make it more robust (`FINAL` when status contains `final`/`finished`, else `SCHEDULED`).
- Update comments to reflect new behavior (full schedule from FP, not only no-player rows).

2) Simplify selector controls (remove redundant arrows)
- File: `src/pages/SchedulePage.tsx`
- Week selector: remove right arrow button (`+` / `ChevronRight`) and keep only left arrow.
- Day selector: remove left arrow button (`-` / `ChevronLeft`) and keep only right arrow.
- Keep existing “Today” button.
- Keep existing wrapping logic for `changeDay(1)` so advancing day can roll to next week correctly.

3) Verify and backfill flow
- Deploy updated `sync-sheet` function.
- Run `Sync Schedule` once (or `Full Sync`).
- Validate:
  - DB: `schedule_games` now includes GW <= 20 (especially GW20 D1).
  - API: `/functions/v1/schedule?gw=20&day=1` returns games.
  - UI: `/schedule` shows finished games + scores/status.

Technical details
- No schema migration required.
- No changes needed in `supabase/functions/schedule/index.ts` or `src/components/ScheduleList.tsx`; they already render `FINAL` rows when present.
- Expected impact: `schedule_games` row count increases significantly beyond 254 after backfill.
