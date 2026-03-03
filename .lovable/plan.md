

## Plan: Full UI Implementation (Prompt 2)

This builds 6 pages, 12+ reusable components, a deterministic lineup optimizer, and an NBA-themed design system — all consuming the existing edge functions via Zod-validated fetchers in `src/lib/api.ts`.

**No API contracts, edge functions, or Zod schemas will be changed.**

---

### 1. Theme & Design System

**`src/index.css`** — Update CSS variables to NBA brand colors:
- `--nba-blue: 216 78% 31%` (#17408B)
- `--nba-red: 351 95% 40%` (#C9082A)  
- `--nba-yellow: 43 97% 57%` (#FDB927)
- Primary → NBA Blue, Destructive → NBA Red, add `--nba-yellow` for action buttons

**`tailwind.config.ts`** — Add `nba-blue`, `nba-red`, `nba-yellow` to the color palette so components can use `bg-nba-yellow`, `text-nba-red`, etc.

---

### 2. Layout & Routing

**`src/components/layout/AppLayout.tsx`** — Global shell:
- Blue header bar with "NBA Fantasy Manager" title
- Top navigation tabs: Home, Edit Line-up, Stats, Transactions, Schedule, AI Hub, More
- Uses `NavLink` from react-router-dom for active state
- Content area renders `<Outlet />`

**`src/App.tsx`** — Add routes wrapped in `AppLayout`:
- `/` and `/roster` → RosterPage
- `/players` → PlayersPage
- `/transactions` → TransactionsPage
- `/schedule` → SchedulePage
- `/stats` → StatsPage
- `/ai` → AIHubPage (shell placeholder)

**Pages to create** (6 files in `src/pages/`):
- `RosterPage.tsx`, `PlayersPage.tsx`, `TransactionsPage.tsx`, `SchedulePage.tsx`, `StatsPage.tsx`, `AIHubPage.tsx`

---

### 3. React Query Hooks

**`src/hooks/usePlayersQuery.ts`** — wraps `fetchPlayers()` with `useQuery`, accepts filter/sort params  
**`src/hooks/useRosterQuery.ts`** — wraps `fetchRosterCurrent()` with `useQuery`  
**`src/hooks/useScheduleQuery.ts`** — wraps `fetchSchedule()` with `useQuery`

All hooks use TanStack React Query for caching, loading states, and error handling.

---

### 4. Reusable Components

All in `src/components/`:

| Component | Purpose |
|---|---|
| `PlayerRow.tsx` | Table row: photo, name, team, FC/BC badge, salary, FP5, Value5, last game FP. Click opens PlayerModal. |
| `PlayerCard.tsx` | Card for court view: photo, name, team, FC/BC badge, salary, FP5, Value5. Captain star indicator. |
| `FiltersPanel.tsx` | Left sidebar: FC/BC toggle, sort dropdown (salary/fp5/value5/stocks5/delta_fp), search input, max salary slider. |
| `RosterCourtView.tsx` | Visual 5+5 court layout with PlayerCards in starter/bench sections. |
| `RosterListView.tsx` | Table layout of roster with columns: Player, FC/BC, Salary, FP5, Delta FP, Stocks5. |
| `PlayerModal.tsx` | Dialog showing PlayerCore, last game stats, FP breakdown (`PTS + REB + 2*AST + 3*STL + 3*BLK`), History tab, Schedule tab. Fetches via `fetchPlayerDetail(id)`. |
| `ScheduleList.tsx` | List of games with teams, tipoff, status, score. Prev/Next buttons for gw/day. |
| `TransactionsTable.tsx` | Simulate flow UI: before/after comparison, delta display, commit button. |
| `BottomActionBar.tsx` | Fixed bottom bar: captain dropdown, Play button, gamedays remaining. |
| `KpiTiles.tsx` | Header tiles: GW, Day, Deadline, Money Remaining, Free Transfers. |
| `ChartsPanel.tsx` | 4 recharts: Starters vs Bench FP5, FP vs FP5 delta, Stocks impact, Salary vs Value5 scatter. |
| `OptimizeDialog.tsx` | Lineup optimizer modal: shows suggested swaps, delta FP5, Apply button. |

---

### 5. Roster Page (`/roster`)

- Fetches `roster-current` + `players-list`
- Resolves player IDs from roster to full player objects
- **KpiTiles** header: GW, Day, Deadline, Bank Remaining, Free Transfers
- Toggle between **CourtView** and **ListView**
- **BottomActionBar**: captain selector (starters only), Play button
- "Optimize Lineup" button opens **OptimizeDialog**
- Save calls `POST /roster-save`
- Toast errors for constraint violations (salary cap, FC/BC minimums)

---

### 6. Lineup Optimizer (Deterministic)

**`src/lib/optimizer.ts`** — Pure function, no AI:
- Input: all players (roster + available), current roster, constraints
- Goal: maximize total FP5 of starters
- Enforce: salary cap, FC min (2), BC min (2)
- Algorithm: greedy swap — for each bench player, check if swapping with any starter increases total FP5 while maintaining constraints
- Output: list of suggested swaps with delta FP5
- "Apply" calls `POST /roster-save` with the new lineup

---

### 7. Players / Waiver Wire Page (`/players`)

- Fetches `players-list` with filter params
- **FiltersPanel** on left: FC/BC filter, sort dropdown, search, max salary
- Main content split into **FRONT COURT** (red header) and **BACK COURT** (blue header) sections
- Each section renders **PlayerRow** components
- **Waiver Mode** toggle: filters out roster players, sorts by value5 desc, limits to top 25
- "Add" button on each row calls `POST /transactions-simulate` and shows result

---

### 8. Transactions Page (`/transactions`)

- Header tiles: Deadline, Free Transfers, Cost, Money Remaining
- Buttons: Auto Pick, Reset, Wildcard (disabled), All-Star (disabled)
- Auto Pick calls `POST /roster-auto-pick`
- Simulate flow: select drop → select add → call `POST /transactions-simulate`
- Display before/after totals, delta FP5, delta Stocks5, validation flags
- If valid, enable Commit button → `POST /transactions-commit`

---

### 9. Schedule Page (`/schedule`)

- Fetches `schedule` with gw/day params
- Prev/Next navigation buttons
- **ScheduleList**: game cards with teams, tipoff time, status, score
- Empty state: friendly placeholder message

---

### 10. Stats Hub (`/stats`)

- Fetches roster + players data
- **ChartsPanel** with 4 recharts charts:
  1. Bar chart: Starters FP5 total vs Bench FP5 total
  2. Bar chart: per-player FP vs FP5 delta
  3. Bar chart: Stocks impact (STL+BLK weighted 3x)
  4. Scatter chart: Salary vs Value5
- All charts handle missing/small datasets gracefully

---

### 11. AI Hub Page (`/ai`) — Shell Only

- Placeholder page with "Coming in Prompt 3" message
- Three card stubs: Suggest Transfers, Pick Captain, Explain Player

---

### Implementation Order

1. Theme/colors update (`index.css`, `tailwind.config.ts`)
2. AppLayout + routing (`App.tsx`, `AppLayout.tsx`)
3. React Query hooks (3 files)
4. Core components: PlayerCard, PlayerRow, KpiTiles, BottomActionBar, FiltersPanel
5. RosterPage with CourtView + ListView
6. Optimizer logic + OptimizeDialog
7. PlayerModal
8. PlayersPage with Waiver Mode
9. TransactionsPage
10. SchedulePage
11. StatsPage with ChartsPanel
12. AIHubPage shell

~25 new files total. No existing API code modified.

