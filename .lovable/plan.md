

## Plan

### A. My Roster Page Changes

#### A1. Decrease court size, remove "Starting 5" bar, add watermark
**File:** `src/components/RosterCourtView.tsx`
- Remove the "Starting 5" header bar (the red `AlertTriangle` div above the court)
- Add a "Starting 5" text watermark centered on the court using absolute positioning with `text-white/10 text-2xl font-heading uppercase tracking-widest`
- Reduce court width slightly (e.g., `max-w-[75%]` or similar constraint) while keeping the 5/3 aspect ratio

#### A2. Increase player card sizes for Starting 5
**File:** `src/components/PlayerCard.tsx`
- Add a new `variant` prop: `"court"` | `"bench"` (replacing the boolean `compact`)
- **Court variant**: larger photo (`w-12 h-12`), larger text (`text-[10px]` for name), larger opponent badges (`w-5 h-5`), bigger FC/BC badges
- **Bench variant**: no player photo, show only team logo + tricode + name + FC/BC badge + salary + Next + Upcoming with larger opponent badges (`w-5 h-5`). Stacked vertically (one on top of another)

#### A3. Move Bench to right side, stacked vertically
**File:** `src/components/RosterCourtView.tsx`
- Change layout from `flex-col` (court + bench below) to `flex-row` (court on left, bench on right)
- Bench rendered as a vertical column (`flex flex-col gap-2`) on the right side, above (or alongside) the ROSTER INFO card
- Bench cards are stacked one on top of another
- Support drag-and-drop between bench cards for reordering within bench

**File:** `src/pages/RosterPage.tsx`
- Adjust the two-column layout: the right column now contains the Bench cards above the ROSTER INFO sidebar

### B. Playing Time Trends — Fix Decreased
**File:** `src/hooks/usePlayingTimeTrends.ts`
- The `players.mpg` column is 0 for all players, making every delta positive
- Fix: compute season average from `player_game_logs` directly — fetch all logs for each player and calculate `total_mp / gp` as the season average
- Query all game logs (not just last 7 days) grouped by player to get season totals, then compare with the 7-day window
- This will produce both increased and decreased lists

### C. Team of the Week on /schedule

#### C1. Add icon button next to the Grid icon
**File:** `src/pages/SchedulePage.tsx`
- Add a Trophy (or Medal) icon button right after the Grid3X3 icon button
- Clicking opens a `TeamOfTheWeekModal`

#### C2. New modal component
**New file:** `src/components/TeamOfTheWeekModal.tsx`
- Modal uses the court background image (`src/assets/court-bg.png`)
- Displays 5 players with the highest FP per game for the selected gameweek
- Enforces 2BC/3FC or 3BC/2FC composition:
  - Sort all players by FP/game descending
  - Pick top players while respecting that the final 5 must have at least 2 FC and 2 BC
  - Algorithm: greedily pick top players, but reserve slots to ensure min 2 of each position
- Uses the same `PlayerCard` component (court variant) positioned on the court like the roster view
- Data source: query `player_game_logs` for the selected GW's date range, aggregate FP per player, join with `players` for name/team/photo/fc_bc

#### C3. New hook for Team of the Week
**New file:** `src/hooks/useTeamOfTheWeek.ts`
- Takes `gw` as parameter
- Queries `player_game_logs` joined with `schedule_games` (to filter by GW) or uses date ranges from `DEADLINES`
- Aggregates FP per player, computes FP/game
- Returns top 5 with position constraints

### Files Summary

| File | Change |
|------|--------|
| `src/components/RosterCourtView.tsx` | Remove Starting 5 bar, add watermark, bench to right side vertical |
| `src/components/PlayerCard.tsx` | Add court/bench variants; court: bigger; bench: no photo, stacked |
| `src/pages/RosterPage.tsx` | Adjust layout — bench in right column above ROSTER INFO |
| `src/hooks/usePlayingTimeTrends.ts` | Compute season avg from game logs instead of players.mpg |
| `src/pages/SchedulePage.tsx` | Add Team of the Week icon button |
| `src/components/TeamOfTheWeekModal.tsx` | New — court-based modal showing top 5 FP players |
| `src/hooks/useTeamOfTheWeek.ts` | New — fetch and compute top 5 with position constraints |

