

## Plan: Nav Rename, Schedule Enhancements, Transactions Add/Remove, Advanced Calendar Grid

### 1. Rename HOME → MY ROSTER
**File:** `src/components/layout/AppLayout.tsx`
- Change `label: "Home"` → `"My Roster"`, icon from `Home` → `ClipboardList` (or `Users`)
- Route stays `/`

### 2. Schedule — Reduce Day Nav Height
**File:** `src/pages/SchedulePage.tsx`
- Reduce day button padding from `py-2` to `py-1`, shrink font sizes
- Remove the `Day X` sub-label and reduce overall height of each day cell

### 3. Schedule — Top FP Players Strip
**File:** `src/pages/SchedulePage.tsx` + new `src/components/TopPlayersStrip.tsx`
- After the day navigator and before the date header, add a horizontal strip showing top 5 FC + top 5 BC by FP for the selected day
- Query `schedule_games` for the selected gw/day to get which teams are playing, then cross-reference with `usePlayersQuery` to find players on those teams
- Sort by `season.fp` descending, take top 5 FC and top 5 BC
- Each entry: circular photo (32px) + name (truncated) + team tricode + FP value
- Two sections side by side: "Top FC" and "Top BC", separated by a divider
- Scrollable horizontally on mobile

### 4. Transactions — Add/Remove Players to Roster
**File:** `src/pages/PlayersPage.tsx`
- Add an action column with a "+" button (or green add icon) for players not on roster, and a "−" button (or red remove icon) for players already on roster
- Use the existing `transactions-commit` API (adds/drops) to execute
- Need to fetch current roster via `useRosterQuery` to know which players are on roster
- Enforce max 2 per team rule: disable add if team already has 2 players
- Show confirmation toast on success, invalidate roster query

### 5. Advanced Calendar Grid (Schedule Grid Overlay)
**Files:** New `src/components/AdvancedScheduleGrid.tsx`, update `src/pages/SchedulePage.tsx`

**Trigger:** A grid icon button placed next to the date range text (e.g., "Apr 6 – Apr 12") in the week navigator bar. Clicking toggles an overlay panel that slides down over the game list.

**Data source:** Query `schedule_games` for the entire selected week (all days of selected gw) via Supabase direct query. Group by team.

**Grid layout (like hashtagbasketball):**
- Header row: TEAM | GAMES | MON | TUE | WED | THU | FRI | SAT | SUN
- "# Games Played" summary row showing total games per day
- One row per NBA team (30 rows), sorted alphabetically
- Each cell shows opponent tricode. Home games show tricode in normal text, away games prefixed with "@"
- GAMES column shows total games for that team in the week

**Day filter:** Checkboxes on the left (or top) for each day of the week — when checked, only teams playing on those days are highlighted/shown. This helps the user see which teams play on specific days.

**Styling:**
- Navy header, yellow accents for active day filters
- Team logo + name in the first column
- Cells with games get a subtle background tint; cells with no game are empty/grey
- Premium glassmorphic card overlay with backdrop blur
- Close button (X) to dismiss

**Hook:** New `src/hooks/useScheduleWeekGames.ts` — fetches all games for a GW:
```ts
supabase.from("schedule_games").select("away_team, home_team, day, gw").eq("gw", gw)
```
Then client-side: map each game to the day-of-week column using the DEADLINES lookup (day → weekday).

### Files Changed

| File | Change |
|------|--------|
| `src/components/layout/AppLayout.tsx` | Rename Home → My Roster, new icon |
| `src/pages/SchedulePage.tsx` | Reduce day nav height, add top players strip, add grid toggle button |
| `src/components/TopPlayersStrip.tsx` | New — top 5 FC + top 5 BC display |
| `src/pages/PlayersPage.tsx` | Add/remove player action column |
| `src/components/AdvancedScheduleGrid.tsx` | New — full advanced calendar grid overlay |
| `src/hooks/useScheduleWeekGames.ts` | New — fetch all games for a GW |

### Implementation Order
1. Rename nav item
2. Reduce day nav height
3. Build TopPlayersStrip + wire it
4. Add/remove column in PlayersPage
5. Build AdvancedScheduleGrid + hook + wire it

