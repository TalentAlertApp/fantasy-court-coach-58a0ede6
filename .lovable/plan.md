

## Multi-fix: Schedule Redesign, Team Filter, Nav Cleanup, Modal Improvements

### 1. Schedule Page Redesign (`src/pages/SchedulePage.tsx`)

Redesign to match reference image-27:

**Week Navigator** (blue bar at top):
- "NBA FANTASY WEEK" header
- Horizontal scrollable row of W1–W25 pills; selected week highlighted (yellow border)
- Below: "Week {N} | {date range} CURRENT" label
- Clicking a week pill sets `gw` and resets `day` to 1

**Day Navigator** (below week bar):
- Horizontal row showing all days of the selected week as columns: "MON 9", "TUE 10", etc.
- Selected day highlighted with blue bg; others are text-only
- Left/right arrows at edges to navigate weeks
- Clicking a day sets `day`

**Date Header**: "Mon, Mar 9 TODAY" (with red TODAY badge when matching today)

**Data source**: Use the existing `CALENDAR` map (date→{week,day}) and `DEADLINES` from `deadlines.ts` to build the day columns. For each day in the selected week, reverse-lookup the date from `WEEK_DAY_TO_DATE`, then format as weekday + date number.

**Games still fetched** via `useScheduleQuery({ gw, day })` — no backend change needed. The CSV data should already be in `schedule_games` from previous imports.

Files: `src/pages/SchedulePage.tsx` (rewrite)

### 2. Team Filter on Players Page

Add a "Team" dropdown to `FiltersPanel`:
- New prop: `team: string`, `onTeamChange: (v: string) => void`
- Render a `Select` with "All Teams" + all 30 NBA team full names from `NBA_TEAMS` sorted alphabetically
- Value = tricode (e.g. "ATL") or "ALL"

In `PlayersPage.tsx`:
- New state `team` defaulting to `"ALL"`
- Pass to `FiltersPanel`
- Add client-side filter: if `team !== "ALL"`, filter by `p.core.team === team` (team field stores tricode)

Files: `src/components/FiltersPanel.tsx`, `src/pages/PlayersPage.tsx`

### 3. Remove Duplicate "Edit Line-up" Tab

Currently `navItems` has both `{ to: "/", label: "Home" }` and `{ to: "/roster", label: "Edit Line-up" }`. Both `"/"` and `"/roster"` route to `RosterPage`. The Index page (`/`) is a health-check page that's no longer relevant.

Fix:
- In `App.tsx`: remove the `"/"` → `Index` route; make `"/"` → `RosterPage` (keep the existing `/roster` route too, or redirect)
- In `AppLayout.tsx` navItems: remove the "Edit Line-up" entry; rename "Home" to show the roster icon and keep `to: "/"` with `end: true`
- Actually simpler: just remove the "Home" entry and change "Edit Line-up" `to: "/"` so it catches both. Or keep both routes pointing to RosterPage but only one nav item.

Approach: Remove "Home" from nav, change "Edit Line-up" to `{ to: "/", label: "Home", icon: Home, end: true }`. In `App.tsx` remove the separate `/` route for Index and make `/` point to `RosterPage`. Keep `/roster` as alias.

Files: `src/components/layout/AppLayout.tsx`, `src/App.tsx`

### 4. Player Modal Fixes

**a) Remove scroll limits**: Change `<ScrollArea className="max-h-64">` to `max-h-[60vh]` (or remove max-h entirely) in both History and Schedule tabs so all games are visible with scrolling.

**b) Remove duplicate player name**: Remove the `<DialogTitle>` that shows the player name at the top of the modal. The name already appears in the core info section below. Set `DialogTitle` to an empty/hidden element (needed for accessibility).

Files: `src/components/PlayerModal.tsx`

---

### Summary of files

| File | Change |
|------|--------|
| `src/pages/SchedulePage.tsx` | Full redesign with week pills + day columns navigation |
| `src/components/FiltersPanel.tsx` | Add Team dropdown filter |
| `src/pages/PlayersPage.tsx` | Add team state + client-side filter |
| `src/components/layout/AppLayout.tsx` | Remove duplicate nav item |
| `src/App.tsx` | Consolidate "/" and "/roster" routes |
| `src/components/PlayerModal.tsx` | Remove name duplication, increase scroll area |

