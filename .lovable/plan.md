

## Multi-Feature Implementation Plan (8 Items)

### 1. Video container: fill full card height
**File:** `src/components/ScheduleList.tsx`
- Change the expanded box score layout from `flex` to a CSS grid: `grid grid-cols-[1fr_auto]` where the right column sizes itself based on the video's 16:9 aspect ratio at the full card height
- Remove fixed `w-[500px]` from the video container. Instead, let the video container height match the left table's height using `self-stretch`, and compute width from height via `aspect-video`
- The left table will naturally shrink, pushing stats closer to names

### 2. Sort indicator: bold header instead of arrow
**File:** `src/components/ScheduleList.tsx`
- Remove the `ArrowDown`/`ArrowUp` icons from sorted column headers
- Instead, apply `font-bold text-foreground` to the active sort column header (vs `text-muted-foreground` for inactive)
- This also eliminates the width jitter caused by the arrow icon, fixing the alignment issue between header text and cell values

### 3. Green TV icon when YouTube recap exists
**File:** `src/components/ScheduleList.tsx`
- In the game card action icons row, change the `Tv2` icon rendering: if the game has a truthy `youtube_recap_id`, render it with `text-green-500` fill color instead of `text-muted-foreground`
- Show the Tv2 icon for all FINAL games (not just when `game_recap_url` exists), colored green when `youtube_recap_id` is set

### 4. Wire BoxScore/Charts/PlayByPlay icons directly to URLs; remove NBAGameModal
**File:** `src/components/ScheduleList.tsx`
- Change `GameActionIcon` for BoxScore, Charts, Play-by-Play: instead of opening `NBAGameModal`, directly `window.open(url, "_blank")`
- For the Recap (Tv2) icon: clicking it scrolls down / expands the card (since recap is embedded inline)
- Remove the `NBAGameModal` import and the modal state/rendering entirely
- Delete or keep `src/components/NBAGameModal.tsx` (keep file but remove usage)

### 5. Player Modal History tab: scrollable
**File:** `src/components/PlayerModal.tsx`
- The History tab already uses `<ScrollArea className="max-h-[60vh]">` (line 150). Looking at the screenshot, the scroll seems to work. However, the `DialogContent` itself may constrain height. Add `max-h-[85vh] overflow-hidden flex flex-col` to DialogContent, and ensure the tabs content area is `flex-1 min-h-0 overflow-hidden` so ScrollArea works properly within the dialog

### 6. Roster Reset + flexible player count
**Files:** `src/pages/RosterPage.tsx`, `src/components/BottomActionBar.tsx`
- Add a "Reset Roster" button (with confirmation dialog) that calls `roster-save` with empty starters/bench arrays
- Modify `handleSave` to allow saving with fewer than 10 players (remove the strict 5+5 check)
- Allow the PlayerPickerDialog to add players when roster < 10 (show "Add Player" slots for missing positions)
- The roster-save function already handles `pid === 0` skips, so it supports partial rosters

### 7. Players page: new "Performance" tab with Total/PG toggle
**Files:** `src/pages/PlayersPage.tsx` (major edit)
- Add a tab bar at top: existing view becomes "Overview", new tab is "Performance"
- Performance tab shows a table with columns: Player, Team, PTS, MP, PS, A, R, B, S
- Toggle between "Total" (sum of all game logs) and "PG" (per game averages)
- Data source: use existing `players` data which has season totals (pts, reb, ast, etc.) and gp (games played). PG = total / gp
- This is independent from the existing stats sidebar

### 8. New "Teams" top-level tab with team list + team modal
**Files:** `src/pages/TeamsPage.tsx` (new), `src/components/TeamModal.tsx` (new), `src/App.tsx`, `src/components/layout/AppLayout.tsx`, `supabase/functions/nba-teams-list/index.ts` (new edge function)
- Add `/teams` route and nav item (before Schedule in nav order)
- **Teams list page**: Card grid showing all 30 NBA teams. Each card has: team logo, team name, active player count (from `player_game_logs` — distinct players with mp > 0), win-loss record (from `schedule_games` FINAL games), games remaining (SCHEDULED games)
- **Team modal** (on click): Tabbed dialog with:
  - "Games Played" — list of FINAL games, each clickable to expand inline or link to schedule
  - "Upcoming" — list of SCHEDULED games
  - "Roster" — all players who played for the team (from `player_game_logs`), showing photo, name, MPG, FP/G
- **Edge function** `nba-teams-list`: aggregates data from `schedule_games`, `player_game_logs`, and `players` tables to return team summaries

### Files Changed Summary

| File | Action |
|------|--------|
| `src/components/ScheduleList.tsx` | Items 1-4: layout, sort UI, green icon, direct links |
| `src/components/NBAGameModal.tsx` | Remove usage (can keep file) |
| `src/components/PlayerModal.tsx` | Item 5: fix scroll in History tab |
| `src/pages/RosterPage.tsx` | Item 6: reset + flexible roster |
| `src/components/BottomActionBar.tsx` | Item 6: adjust save validation |
| `src/pages/PlayersPage.tsx` | Item 7: Performance tab |
| `src/pages/TeamsPage.tsx` | Item 8: new page |
| `src/components/TeamModal.tsx` | Item 8: new modal |
| `supabase/functions/nba-teams-list/index.ts` | Item 8: new edge function |
| `src/lib/api.ts` | Item 8: add fetchNbaTeamsList |
| `src/lib/contracts.ts` | Item 8: add schemas |
| `src/App.tsx` | Item 8: add /teams route |
| `src/components/layout/AppLayout.tsx` | Item 8: add Teams nav item |

### Implementation Order
1. Items 1-4 (ScheduleList changes — single file, can do together)
2. Item 5 (PlayerModal scroll fix — quick)
3. Item 6 (Roster reset — moderate)
4. Item 7 (Players Performance tab — moderate)
5. Item 8 (Teams page — largest, new page + edge function)

