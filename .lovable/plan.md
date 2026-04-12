

## Plan: Schedule Buttons, Top Players Dropdown, Wishlist Separator, and Filter Toggle Fix

### 1. Schedule Page (`src/pages/SchedulePage.tsx`)

**a) Team of the Week button redesign**
- Replace the bare `Trophy` icon with a styled button: `<Medal className="h-4 w-4" /> Team of the Week`
- Use `Medal` icon (more context-sensitive than Trophy) from lucide-react
- Give it a fixed width, styled as a subtle outlined button with rounded corners
- Show disabled/muted state when no data available (can check if `gw` has final games)

**b) Top Players of the Day — collapsible dropdown replacing strip**
- Remove `<TopPlayersStrip>` from the sticky header area
- Add a new button `<Star className="h-4 w-4" /> Players of the Day` next to the Team of the Week button, same width
- Clicking it toggles a collapsible panel below the sticky header with two tabs: FP and VALUE
- The panel reuses the existing `TopPlayersStrip` data logic but renders in a larger, more readable layout
- Both buttons get `min-w-[180px]` for equal width

**c) Active/inactive state for both buttons**
- Active (has data): normal styling, clickable
- Inactive (no data): `opacity-50 cursor-not-allowed`, tooltip "No data for this day"

**d) Expandable game details — increase sizes**
- In `GameBoxScore`: increase player row font from `text-sm` to `text-base`, avatar from `h-5 w-5` to `h-7 w-7`, column header text from `text-[10px]` to `text-xs`, stat values from `text-xs` to `text-sm`
- In `UpcomingGamePreview`: increase team logo from `w-5 h-5` to `w-8 h-8`, stats grid from `text-[10px]` to `text-xs`, last 5 games text from `text-[10px]` to `text-xs`

**e) Advanced Grid icon separator**
- Add `<span className="text-muted-foreground/40">·</span>` before the Grid3X3 icon (after the deadline info)

### 2. Wishlist Modal (`src/components/WishlistModal.tsx`)

- Add a `|` separator between the FP value and salary: change from adjacent spans to `<span>FP</span> <span class="text-muted-foreground/40">|</span> <span>$salary</span>`

### 3. Transactions Filter (`src/components/FiltersPanel.tsx`)

- Change the ALL toggle active color: when `fcBc === "ALL"`, apply `!bg-primary !text-primary-foreground` (blue) instead of the default which currently looks like yellow
- This differentiates ALL (blue) from BC (yellow) and FC (red)

### Files Summary

| File | Changes |
|------|---------|
| `src/pages/SchedulePage.tsx` | Replace strip with two equal-width buttons + collapsible Players of Day panel; add dot separator before Grid icon |
| `src/components/TopPlayersStrip.tsx` | Refactor into a dropdown panel with FP/VALUE tabs |
| `src/components/ScheduleList.tsx` | Increase all sizes in GameBoxScore and UpcomingGamePreview |
| `src/components/WishlistModal.tsx` | Add `|` separator between FP and salary |
| `src/components/FiltersPanel.tsx` | Change ALL toggle to blue when active |

