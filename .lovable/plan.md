

## Plan: Restructure Navigation, Merge Waiver Wire into Transactions, Promote Performance Tab

### Summary
1. **PlayerPickerDialog**: Add scrolling fix and FC/BC filter toggle
2. **Merge Waiver Wire into Transactions page** with filters sidebar (matching nbafantasy.nba.com/transfers layout)
3. **Promote Performance tab** to top-level "Players" tab (full screen, replacing old "Waiver Wire" nav)
4. **Fix Performance tab data**: GP always shows total games, PER GAME = total/GP, TOTALS = raw sums

---

### 1. PlayerPickerDialog — scrolling + FC/BC filter
**File:** `src/components/PlayerPickerDialog.tsx`
- Add `fcBcFilter` state (`"ALL" | "FC" | "BC"`)
- Add a `ToggleGroup` in the header (below title, above search) for ALL / FC / BC
- Filter `available` list by `fcBcFilter`
- The `ScrollArea` already has `max-h-[55vh]` which should scroll — verify `flex-1 min-h-0` is on the parent

### 2. Merge Waiver Wire into Transactions
**File:** `src/pages/TransactionsPage.tsx` (major rewrite)
- Add two sub-tabs at the top: **"Transfers"** (the drop/add/simulate flow) and **"Waiver Wire"** (the current Waiver Wire content from PlayersPage)
- Move the Waiver Wire rendering logic (FC/BC tables, filters sidebar, waiver mode, pagination) from `PlayersPage.tsx` into `TransactionsPage.tsx`
- Include `FiltersPanel` sidebar with all existing filters (position, team, sort, search, max salary)
- Keep the KPI tiles, Auto Pick, Reset, Wildcard/All-Star buttons at the top (shared across both sub-tabs)
- The "Sorted by" dropdown should include all the options from the reference image (Total FP, Gameday FP, Salary, Points scored, Rebounds, Assists, Blocks, Steals, FP per game, Value, etc.)

### 3. Promote Performance → top-level "Players" page
**Files:** `src/pages/PlayersPage.tsx`, `src/App.tsx`, `src/components/layout/AppLayout.tsx`
- **PlayersPage.tsx**: Remove the Waiver Wire tab entirely. Keep only the Performance tab content as the full page. Rename from "Performance" to just be the page content (PER GAME / TOTALS toggle)
- **AppLayout.tsx**: Rename nav item from `"Waiver Wire"` to `"Players"`, keep the `Users` icon, keep route `/players`
- **App.tsx**: No route changes needed (already `/players`)

### 4. Fix Performance tab data accuracy
**File:** `src/pages/PlayersPage.tsx` (now the Players page)
- **GP column**: Always show `p.season.gp` (total games played since season start) in both PER GAME and TOTALS modes
- **PER GAME mode**: For each stat (PTS, MP, REB, AST, STL, BLK, FP), compute `total_X / gp` and display with 1 decimal. Use `total_pts / gp`, `total_mp / gp`, etc. — NOT the `p.season.pts` (which may already be per-game but from inconsistent source)
- **TOTALS mode**: Display `total_pts`, `total_mp`, `total_reb`, `total_ast`, `total_stl`, `total_blk`, `total_fp` as integers

### Files Changed Summary

| File | Change |
|------|--------|
| `src/components/PlayerPickerDialog.tsx` | Add FC/BC toggle filter in header |
| `src/pages/TransactionsPage.tsx` | Major rewrite: add Transfers + Waiver Wire sub-tabs with filters |
| `src/pages/PlayersPage.tsx` | Strip to Performance-only (full screen Players page) |
| `src/components/layout/AppLayout.tsx` | Rename "Waiver Wire" → "Players" |

### Implementation Order
1. `PlayerPickerDialog` — FC/BC toggle (quick)
2. `PlayersPage` — strip to Performance only, fix PG/Total formulas
3. `TransactionsPage` — merge in Waiver Wire with filters
4. `AppLayout` — rename nav label

