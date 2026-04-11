

## Plan: Fix Top Players Strip + Full-Page Advanced Schedule Grid

### 1. TopPlayersStrip — Hide when no games on selected day
**File:** `src/components/TopPlayersStrip.tsx`
- The strip already returns `null` when `topFC` and `topBC` are empty, but this depends on player data existing. Add an explicit early check: if no games exist for the selected day (i.e., `teamsPlaying.size === 0`), return empty arrays immediately — ensuring no strip renders.

### 2. Advanced Schedule Grid — Full page instead of overlay
**Files:** `src/pages/ScheduleGridPage.tsx` (new), `src/App.tsx`, `src/pages/SchedulePage.tsx`, `src/components/AdvancedScheduleGrid.tsx`

- Create a new route `/schedule/grid` with a dedicated full-page component
- The grid icon in SchedulePage navigates to `/schedule/grid?gw=X` instead of toggling a modal
- Remove the `showGrid` state and inline `<AdvancedScheduleGrid>` from SchedulePage

**ScheduleGridPage layout (full page):**
- Full navy header with "Advanced Schedule Grid · GW X" title and a back button (← Back to Schedule)
- Left sidebar panel: "Show teams playing on:" with checkbox for each day of the week (day name + date). Selecting days filters the table to only show teams that play on ALL/ANY selected days. Columns for selected days get highlighted with yellow accent.
- Main area: full-width table with sticky Team column, G (games) column, and one column per day
- Each cell shows opponent tricode (home = plain, away = `@OPP`)
- Totals row below header showing game count per day
- Team rows: logo + tricode, color-coded game count (green ≥4, red ≤2), cells with games get subtle background tint
- Responsive: table scrolls horizontally, sidebar collapses on mobile

**Premium styling:**
- Full-height layout using the page space properly
- Larger text (12-13px for cells vs current 10px)
- Row hover highlight
- Selected day columns get a subtle yellow column highlight through all rows
- Sticky left column for team names
- Clean navy/yellow color scheme consistent with app

### Files

| File | Change |
|------|--------|
| `src/components/TopPlayersStrip.tsx` | Early return when no games on selected day |
| `src/pages/ScheduleGridPage.tsx` | New full-page grid with sidebar day filter |
| `src/App.tsx` | Add `/schedule/grid` route |
| `src/pages/SchedulePage.tsx` | Grid icon navigates to `/schedule/grid?gw=X` instead of modal toggle; remove `showGrid` state and `AdvancedScheduleGrid` import |
| `src/components/AdvancedScheduleGrid.tsx` | Can be deleted (logic moves into ScheduleGridPage) |

