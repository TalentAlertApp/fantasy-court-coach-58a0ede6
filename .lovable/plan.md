

## Plan: Sticky grid header, relocate Active Team selector, and add daily Grid view

### 1. `/schedule/grid` — make TEAM column header + #GAMES totals row truly sticky on vertical scroll
File: `src/pages/ScheduleGridPage.tsx`

The current markup puts `sticky top-0` on `<thead>`, but `position: sticky` on `<thead>`/`<tr>` is ignored by most browsers — only `<th>`/`<td>` cells become sticky. That's why on vertical scroll the team header row and the `#GAMES` totals row drift away. Fix:

- Remove `sticky top-0 z-10` from `<thead>`.
- Header row 1 (`Team` / `G` / day columns): add `sticky top-0 z-20` to **every `<th>`** in the row. The corner `Team` cell becomes `sticky top-0 left-0 z-30` so it pins to both top + left. The `G` cell becomes `sticky top-0 z-20`. Day columns become `sticky top-0 z-10`.
- Header row 2 (`# Games` totals): each `<td>` gets `sticky top-[37px] z-20` (37px ≈ height of row 1; we'll use a CSS variable or a fixed `top-[36px]` matching `py-2.5` height). The corner `# Games` cell becomes `sticky top-[37px] left-0 z-30`. Day total cells get `sticky top-[37px] z-10`.
- Body `<td>` for the team-name cell keeps `sticky left-0 z-10` (already correct) so the team column stays pinned during horizontal scroll.
- Result: the corner `Team` label + the `#GAMES` totals row stay pinned at top during vertical scroll, while the team rows beneath them scroll. Day columns continue to scroll horizontally.

### 2. Remove the Active Team header pill from the top of every page
File: `src/components/layout/AppLayout.tsx`

The "Active Team" pill on the top-right is redundant — `TeamSwitcher` already lives in the left sidebar (line 75 of `AppLayout.tsx`). It also wastes ~40px of vertical space on every page (visible in the user's screenshot as a near-empty bar above the GW header).

Changes:
- Delete the `<div className="sticky top-0 z-30 flex justify-end ... border-b">` wrapper that renders `<HeaderTeamPill />` (lines 111-113).
- Drop the `import HeaderTeamPill` line.
- The `<HowToPlayModal>` icon already lives inside the sidebar brand area, so accessibility isn't impacted.
- Keep `src/components/layout/HeaderTeamPill.tsx` on disk (unreferenced) in case we want it back — minimal cost.
- `TeamSwitcher` in the sidebar already shows the currently selected team and lets the user switch — no functional regression.

### 3. `/schedule` — add a Grid view toggle for the daily games list
File: `src/components/ScheduleList.tsx` (+ tiny addition to `src/pages/SchedulePage.tsx`)

Add a List ↔ Grid view switcher for the day's games. Default view is **Grid** (4 cards per row on desktop, fewer on smaller viewports). When a card is clicked it expands the **same full-width preview block underneath** (identical content to today's expanded list row — `GameBoxScore` for finals, `UpcomingGamePreview` for scheduled). No layout changes inside the expanded block.

#### 3a. View toggle
- In `SchedulePage.tsx`, next to the existing `Grid3X3` icon (advanced grid link), add a small two-button segmented toggle: `List` icon (`Rows3`) and `Grid` icon (`LayoutGrid`). Persist the choice in `localStorage` (`schedule_view_mode`, default `"grid"`).
- Pass the mode down to `<ScheduleList games={...} viewMode={mode} />`.

#### 3b. Grid layout in `ScheduleList`
- Add `viewMode?: "list" | "grid"` to `ScheduleListProps` (default `"grid"`).
- In **list mode**: render exactly today's layout — unchanged.
- In **grid mode**: replace the outer `<div className="space-y-2 px-1">` with a responsive grid container `grid gap-2 px-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
- Each game becomes a compact **card**:
  - The same arena background image + gradient overlay as today.
  - Vertical layout: `[Away logo][Away tricode]   @   [Home logo][Home tricode]` on one line; status (`SCHEDULED` / `FINAL` / `LIVE`) + tipoff time below; venue name in italic at the bottom.
  - Score (when final/live) shown next to each tricode.
  - Action icons (Recap, Box Score, Charts, Play-by-Play, External link, Chevron) in a compact row at the card's bottom.
  - Card border + status border-l-4 + rounded-xl identical to list.
- Click handling: clicking the card toggles `expandedId` exactly as today.

#### 3c. Same-window full-width expansion
- Wrap the grid in a `<div>` and render the cards inside. When `expandedId` is set, immediately after the **row containing that card** (computed by `Math.floor(index / colsPerRow)`), insert a full-width `<div className="col-span-full">` that renders the same `GameBoxScore` / `UpcomingGamePreview` block already used today.
- Implementation: instead of computing rows manually, render two nested loops — split `games` into chunks of `colsPerRow` (track `colsPerRow` via a Tailwind-aware breakpoint hook OR use CSS-only by giving the expanded panel `col-span-full` via grid auto-flow). Simplest approach:
  - Use a **CSS grid** with `grid-flow-row-dense` and give each card a wrapper. After every row of cards, conditionally render the expanded panel as a sibling with `className="col-span-full"`. Determine row by index `Math.floor(i / colsPerRow)` — read `colsPerRow` from a `useMediaQuery`-style hook (`1` < sm, `2` < lg, `3` < xl, `4` ≥ xl).
  - The expanded block keeps full width below the card row, no width changes — exactly what the user requested.

#### 3d. Edge cases
- Clicking a different card while one is open: closes the previous, opens the new (existing behaviour unchanged).
- Live games: card shows pulsing `LIVE` badge identical to list view.
- Empty state ("No Games Scheduled"): unchanged regardless of mode.

### Files touched
- `src/pages/ScheduleGridPage.tsx` — switch sticky-positioning from `<thead>` to individual `<th>`/`<td>` cells so the TEAM column header and the #GAMES totals row remain pinned during vertical scroll.
- `src/components/layout/AppLayout.tsx` — remove the top Active Team pill bar; drop the `HeaderTeamPill` import.
- `src/components/ScheduleList.tsx` — add `viewMode` prop and a card-grid layout with full-width in-place expansion.
- `src/pages/SchedulePage.tsx` — add a List/Grid view toggle (persisted in `localStorage`) and pass `viewMode` to `<ScheduleList>`.

### Verification
- `/schedule/grid`: scroll vertically — `Team` column header and the `# Games` totals row stay pinned at the top while team rows scroll under them. Scroll horizontally — `Team` column stays pinned to the left as today.
- Any page: the "Active Team" pill no longer appears at the top right; the sidebar Team Switcher remains the single control.
- `/schedule`: a List/Grid toggle sits next to the existing Grid3X3 icon. Default loads in Grid view showing 4 cards per row on wide screens; clicking a card expands a full-width panel below the card's row containing the same boxscore/preview content as today, with no width clipping.

