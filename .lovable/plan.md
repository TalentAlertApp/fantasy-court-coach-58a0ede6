

## Plan: UI Polish, Data Columns, and AI Coach Fixes

### 1. Transactions Page (`/transactions`)

**a) Add FP5 and V5 columns** (`src/pages/PlayersPage.tsx`)
- Add two new columns `FP5` and `V5` right after `GP` in the table header and body
- `FP5` = `p.last5.fp5` (always per-game, doesn't change with PER GAME/TOTALS toggle)
- `V5` = `p.computed.value5` (same — always the same value regardless of toggle)
- Both displayed with 1 decimal place, font-bold

**b) Remove SORT BY dropdown** (`src/components/FiltersPanel.tsx`)
- Remove the entire "Sort By" section (Label + Select) from FiltersPanel since column headers already allow sorting
- Remove `sort`/`onSortChange` props from FiltersPanel interface and caller

### 2. Schedule Page (`/schedule`)

**a) Center GW title, yellow date range** (`src/pages/SchedulePage.tsx`)
- Change the GW label row to `justify-center text-center`
- Make the date range portion (`|Apr 6 – Apr 12`) use `dark:text-[hsl(var(--nba-yellow))]` while GW number stays yellow too

**b) Separate Grid3X3 and Trophy icons with "|"** (`src/pages/SchedulePage.tsx`)
- Add a `<span className="text-muted-foreground opacity-40">|</span>` between the two icon buttons

**c) Selected day rounded background, bold game count** (`src/pages/SchedulePage.tsx`)
- Change selected day button from square `border-b-2` style to `rounded-xl bg-primary` pill style
- Add `font-bold` to the game count text (`{gameCount}G`)

### 3. Roster Page — Next game badge order (`/`)

**a) Fix upcoming opponent order** (`src/components/PlayerCard.tsx`)
- Currently `upcoming[0]` is "Next" shown separately, and `upcoming.slice(1,7)` are the subsequent days
- The 6 slots should fill left-to-right with the soonest game first. The issue: the "Next" game is displayed separately above the 6-slot grid. Instead, merge all upcoming into a single row of 6 slots (remove the separate "Next" display), showing them chronologically left-to-right for the court variant

### 4. Sidebar icon colors (`src/components/layout/AppLayout.tsx`)
- Add `text-[hsl(var(--nba-yellow))]` to all nav item icons (or add a CSS rule for `.nav-item .lucide { color: hsl(var(--nba-yellow)); }`)

### 5. Player Modal — Remove container from Compare/Wishlist icons (`src/components/PlayerModal.tsx`)
- Remove `bg-primary/20 rounded-lg` from Compare button, and `bg-muted rounded-lg` from Wishlist button
- Make them plain icon buttons without background containers

### 6. Wishlist Modal redesign (`src/components/WishlistModal.tsx`)
- Move FC/BC badge to far left of each player row
- Add FP average (`p.season.fp`) to the card
- Remove the small team badge icon
- Add team badge as centered watermark (large, low opacity) behind each player row with hover surge

### 7. AI Coach fixes (`src/components/AICoachModal.tsx`)

**a) Injuries tab — `#id` instead of player name**
- Root cause: `handleInjury` passes `rosterPlayerIds` as the full array of slot objects (starters/bench), not just player IDs. The `getPlayerName` then receives a slot object ID, not a player ID
- Fix: Extract actual player IDs from roster slots: `const ids = [...(rosterData.roster.starters ?? []), ...(rosterData.roster.bench ?? [])].map(s => s.player_id).filter(Boolean)`
- Also: increase `usePlayersQuery` limit to 500 to match the players page, ensuring `getPlayerName` can resolve all players

**b) Explain tab — can't find players**
- Root cause: `usePlayersQuery()` with no params defaults to limit 200, so many players are missing from the search pool
- Fix: Change to `usePlayersQuery({ limit: 500 })` so all players are searchable

### Files Summary

| File | Changes |
|------|---------|
| `src/pages/PlayersPage.tsx` | Add FP5/V5 columns after GP |
| `src/components/FiltersPanel.tsx` | Remove Sort By section |
| `src/pages/SchedulePage.tsx` | Center GW title, yellow date range, separator between icons, rounded day buttons, bold game count |
| `src/components/PlayerCard.tsx` | Fix upcoming badge order (left-to-right chronological) |
| `src/components/layout/AppLayout.tsx` | Yellow sidebar icons |
| `src/components/PlayerModal.tsx` | Remove containers from Compare/Wishlist buttons |
| `src/components/WishlistModal.tsx` | Redesign: badge left, FP avg, watermark team logo |
| `src/components/AICoachModal.tsx` | Fix injury player_ids extraction, increase query limit to 500 |

