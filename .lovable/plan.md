

## Plan: Merge Transactions into Players Page

### Summary
Remove the old `/transactions` page entirely. Move its FiltersPanel sidebar into the `/players` page (right side). Rename the `/players` route to `/transactions` in the router and nav.

### Changes

**1. Rewrite `src/pages/PlayersPage.tsx` → becomes the new Transactions page**
- Add the FiltersPanel on the right side of the players table (flex layout: table left, filters right)
- Wire all filter state (fcBc, team, sort, search, maxSalary) to the existing players table
- Keep the existing Per Game / Totals toggle and all columns
- Add pagination from the old TransactionsPage
- Dynamic `maxSalaryLimit` from player data
- Title changes from "Players" to "Transactions"

**2. Update `src/App.tsx`**
- Remove `/players` route
- Change `/transactions` to render the updated `PlayersPage` component
- Add redirect from `/players` → `/transactions`

**3. Update `src/components/layout/AppLayout.tsx`**
- Remove the "Players" nav item
- Keep "Transactions" nav item (already exists)

**4. Delete `src/pages/TransactionsPage.tsx`**
- No longer needed

### Layout of new Transactions page
```text
┌─────────────────────────────────┬──────────┐
│  Header: "Transactions"         │          │
│  [Per Game] [Totals]            │ FILTERS  │
│                                 │ Position │
│  ┌────────────────────────────┐ │ Team     │
│  │ Player table (full width)  │ │ Sort By  │
│  │ GP PTS MP REB AST STL BLK │ │ Search   │
│  │ FP $                      │ │ Max $    │
│  └────────────────────────────┘ │          │
│  Pagination                     │          │
└─────────────────────────────────┴──────────┘
```

### Files

| File | Change |
|------|--------|
| `src/pages/PlayersPage.tsx` | Add FiltersPanel on right, wire all filters to table, rename title |
| `src/App.tsx` | Remove `/players` route, point `/transactions` to PlayersPage, add redirect |
| `src/components/layout/AppLayout.tsx` | Remove "Players" nav item |
| `src/pages/TransactionsPage.tsx` | Delete |

