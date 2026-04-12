

## Plan: Comprehensive UI Polish, Rules Enforcement, and Bug Fixes

### 1. Remove auto-sync on page load (`src/components/layout/AppLayout.tsx`)
- Remove `shouldAutoSync()` function
- Remove the `useEffect` that calls `handleSync()` on load and on interval
- Remove `syncStatus` query, `isSyncingFlag`, `pollRef`, `stopPolling`, `startPolling`, `handleSync`, `invalidateAll`
- Remove imports: `triggerSync`, `fetchSyncStatus`, `useQuery`, `useQueryClient`, `useCallback`, `useRef`
- Keep sidebar, theme, nav — just strip all sync logic

### 2. Schedule Page (`src/pages/SchedulePage.tsx`)

**a) Day strip layout rework**: Each day button becomes a horizontal row:
- Left: `<DAY> <NUMBER>` (e.g., `MON 6`), bigger font (`text-xs` for day, `text-base` for number)
- Center: `<gw>.<day>` in bold (e.g., `25.1`)
- Right: `<gameCount>G` in bold
- Increase overall height of each day button

**b) Week strip — fix active week border clipping**: The selected week button uses `ring-2` but it's clipped by the overflow container. Add `py-1` padding around the scroll container or use `outline` instead of `ring` to avoid clipping.

### 3. Rules Enforcement

**a) Budget cap at SWAP PLAYER modal (`src/components/PlayerPickerDialog.tsx`)**:
- Add `bankRemaining` and `swapPlayerSalary` props
- Calculate available budget: `bankRemaining + swapPlayerSalary`
- Disable players whose salary exceeds available budget, show "OVER BUDGET" label
- Display budget available at top of modal: `Budget: $X.X`

**b) Position filtering on swap**: Add `swapPlayerPosition` prop
- When swapping (10-player roster), force the filter to the position of the player being swapped out and hide the toggle
- When adding (roster not full), show toggle as normal

**c) Wire these from `RosterPage.tsx`**: Pass `bankRemaining`, `swapPlayerSalary`, and `swapPlayerPosition` to `PlayerPickerDialog`

**d) Swap Player modal toggle colors**: 
- Dark theme: ALL → neutral (muted), FC → red (`bg-destructive`), BC → blue (`bg-primary`)
- Light theme: FC → red, BC → blue
- Use `dark:` prefix for theme-specific styling

### 4. Transactions Page (`src/pages/PlayersPage.tsx`)

**a) ALL toggle color**: Change from yellow to a neutral/muted color for dark theme only — use `dark:!bg-muted dark:!text-foreground` when active (via `FiltersPanel.tsx` update to ALL toggle)

**b) Remove `<Info>` icon from column headers**: Keep `<Tooltip>` wrapping the label text itself, remove the visible `<Info>` icon element

**c) Add tooltips to GP, FP5, V5, $**: Add entries to `columnTooltips` for these columns and wrap their headers in tooltips

**d) Make GP, FP5, V5 sortable**: Add `cursor-pointer` and `onClick={() => handleSort(...)}` to these column headers. FP5 sorts on `last5.fp5`, V5 sorts on `computed.value5`. Update `getVal` in sort logic to handle `fp5` and `value5` keys.

**e) Active sort column styling**: Add a distinct color (e.g., `text-primary`) and `font-bold` to the currently sorted column's header AND cell values

### 5. Roster Page (`src/pages/RosterPage.tsx`)

**a) Hover tooltips on chip buttons**: Add `title` attributes:
- Captain: "Activate Captain chip — doubles captain's FP"
- All-Star: "Activate All-Star chip — boost all starters"
- Wildcard: "Activate Wildcard chip — unlimited free transfers"
- Optimize: "Auto-optimize lineup for maximum FP"
- Reset: "Remove all players from roster"

**b) Optimize button hover color**: Add `hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500` for dark theme, `hover:bg-yellow-400 hover:text-black` for light theme

**c) Add V5 to player cards** (`src/components/PlayerCard.tsx`):
- Court variant: after `$salary`, add `| V5` (e.g., `$22.6 | 3.3`)
- Bench variant: same — after salary, add `| V5`
- Source: `player.computed.value5`

### 6. AI Coach — Explain Tab (`src/components/AICoachModal.tsx`)

**a) Autocomplete dropdown**: After user types 3+ characters, show matching players in a dropdown below the input
- Normalize search: strip diacritics using `str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")` for both search and player names
- Match on any part of player name OR team name
- Dropdown card: circular photo (with surge on hover), team long name, FC/BC badge, team logo watermark at far-right
- On select, populate the input and set the player ID

**b) Fix wrong player match**: The current `.includes()` match returns the first partial match — "Gonz" matches "Edgecombe" if any player with "Gonz" in the name doesn't exist but a partial match triggers. Fix: use the autocomplete selection to set the exact player ID, not a search-based match on button click

**c) Diacritics-insensitive search**: `"Doncic"` matches `"Dončić"`

### 7. Player Card — Fix 7→6 upcoming slots (`src/components/PlayerCard.tsx`)
- Court variant: change `grid-cols-7` to `grid-cols-6`, `Array.from({ length: 7 })` to `{ length: 6 }`, and `slice(0, 7)` to `slice(0, 6)`
- Increase opponent badge size from `w-6 h-6` to `w-7 h-7` (in `OpponentBadge` "md" size)

### 8. Advanced Page — Playing Time Trends (`src/pages/AdvancedPage.tsx`)

**a) Wire player names to player detail modal**: Add `PlayerModal` state, wrap player name in a clickable element that opens the modal with `r.id`

**b) Wire team badges to team detail modal**: Add `TeamModal` state, wrap team logo in a clickable element that opens the modal with `r.team`

**c) Hover color on rows**: Add `hover:bg-accent/30 transition-colors cursor-pointer` to each trend row

### Files Summary

| File | Changes |
|------|---------|
| `src/components/layout/AppLayout.tsx` | Remove all sync logic |
| `src/pages/SchedulePage.tsx` | Day strip layout rework, fix week border clipping |
| `src/components/PlayerPickerDialog.tsx` | Budget enforcement, position lock on swap, toggle colors |
| `src/pages/RosterPage.tsx` | Pass budget/position to picker, tooltips on buttons, optimize hover color |
| `src/components/PlayerCard.tsx` | Add V5 after salary, fix 7→6 slots, increase badge size |
| `src/pages/PlayersPage.tsx` | Sortable GP/FP5/V5, remove Info icons, add tooltips, active column styling |
| `src/components/FiltersPanel.tsx` | ALL toggle neutral in dark theme |
| `src/components/AICoachModal.tsx` | Autocomplete dropdown with diacritics normalization, fix wrong match |
| `src/pages/AdvancedPage.tsx` | Wire player/team modals, row hover |

