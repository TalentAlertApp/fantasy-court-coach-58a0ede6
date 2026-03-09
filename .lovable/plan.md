

## Schedule Page Overhaul — 6 Items

### a) Fix Game URLs in Database
The DB currently has wrong URLs like `https://www.nba.com/game/22500931`. The CSV has correct ones like `https://www.nba.com/game/phi-vs-cle-0022500931`. Will parse all 1,230 rows from the CSV and bulk UPDATE both `schedule_games` and `games` tables using the insert tool. No more URL generation — use CSV values verbatim.

### b) Week pills: full-width spread + past weeks dimmed
Change the week navigator from `flex gap-1.5` to a grid or flex with `flex-1` per pill so they spread across the full bar width. Past weeks (gw < current.gw) get a dimmed/muted style vs future weeks.

### c) Day selector: show game day number
Add the game day number (e.g., "1") below the date number in each day pill. Layout becomes: `MON` → `9` → `1` (day number) → `(5)` game count.

### d) Deadline inline with date header
Move the deadline from its own row to inline with the date header row: `MON, MAR 9 — Day 1 · Deadline: 22:30 [TODAY] [Today btn]`

### e) Boxscore: max 10 players + scroll, FC/BC color
- Wrap boxscore player list in a `max-h` container with `overflow-y-auto` to cap at ~10 visible rows
- Change FC/BC badge from `variant="outline"` to `variant={p.fc_bc === "FC" ? "destructive" : "default"}` matching the rest of the app

### f) UI/UX refresh — NBA feel
- Game rows: larger team logos (w-7 h-7), bolder scores, add subtle gradient accent on FINAL games
- Add colored left border per game status (green = FINAL, yellow = LIVE, transparent = SCHEDULED)  
- Tipoff time displayed in Lisbon timezone using `Intl.DateTimeFormat`
- Better spacing, card-like feel with hover states
- Week navigator: add subtle gradient, larger text
- Day navigator: more prominent selected state with primary bg fill instead of just border

### Files Changed

| File | Changes |
|------|---------|
| `src/pages/SchedulePage.tsx` | Week pills full-width + dimmed past; day pills show game day #; deadline inline; better styling |
| `src/components/ScheduleList.tsx` | Boxscore scroll cap, FC/BC colors, game row UI refresh, Lisbon timezone for tipoff, larger logos |
| Database (insert tool) | Bulk UPDATE ~1,230 game URLs from CSV into `schedule_games` and `games` |

