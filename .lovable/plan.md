

## Three Schedule Page Improvements

### 1. Sort games by tipoff time
The edge function already orders by `tipoff_utc ASC` — games with early-morning UTC times (e.g., 01:00 AM games) sort correctly since they're stored as full UTC timestamps. No backend change needed. However, null tipoff games could sort oddly. Will add `nullsFirst: false` to push nulls to the end.

### 2. Game count badge per day
Currently the page only fetches games for the selected day. To show counts for all days in the week, we need a lightweight query that fetches game counts per day for the selected week.

**Approach:** Add a new `useScheduleWeekCounts` hook that queries `schedule_games` directly via Supabase client (no edge function needed) — a simple `SELECT gw, day, count(*)` grouped query. Display the count as a small badge inside each day selector button.

### 3. Import Game URLs from CSV + display link
The CSV has ~1,230 rows mapping `game_id → nba_game_url`. These need to be bulk-updated into `schedule_games.nba_game_url` and `games.nba_game_url`. Then add a clickable link icon in the game row UI.

---

### Changes

| File | What |
|------|------|
| `supabase/functions/schedule/index.ts` | Add `nullsFirst: false` to tipoff_utc ordering |
| `src/hooks/useScheduleWeekCounts.ts` | **New** — query game counts per day for a week |
| `src/pages/SchedulePage.tsx` | Use week counts hook; show count badge in day buttons |
| `src/components/ScheduleList.tsx` | Add NBA.com link icon per game row (using `nba_game_url`) |
| Database | Bulk UPDATE `schedule_games` and `games` with `nba_game_url` from CSV (~1,230 rows) |

### Day count badge UI
Inside each day button, below the date number (and today dot), add a small muted count like:

```text
  MON
   9
   •        ← today dot (if today)
  (5)       ← game count
```

### Game URL link
Add a small external-link icon next to the tipoff time in each game row. Clicking opens the NBA.com game page in a new tab. Only shown when `nba_game_url` is non-null.

### Database bulk update
Parse the CSV and run batched `UPDATE schedule_games SET nba_game_url = ... WHERE game_id = ...` and same for `games` table, using the insert tool.

