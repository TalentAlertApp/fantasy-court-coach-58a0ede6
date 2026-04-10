

## Plan: Fix 7 Issues Across Roster, AI Coach, and Transactions

### 1. Chips System — Interactive Buttons on Roster Page
**File:** `src/pages/RosterPage.tsx`
- Add 3 chip buttons in the toolbar: **Gameday Captain** (toggle on/off per gameday), **All-Star** (once/season), **Wildcard** (3/season)
- For now these are visual/state toggles (no backend persistence yet) — styled as accent buttons that highlight when active
- Captain chip doubles the captain's score (visual indicator on the captain card)

### 2. Deadline Countdown Timer on Roster Page
**File:** `src/pages/RosterPage.tsx`
- Add a live countdown timer next to the existing deadline text in the header banner
- Use `useEffect` with `setInterval(1000)` to compute `deadline_utc - now` and display as `Xh Ym Zs`
- When expired, show "LOCKED" in red

### 3. Captain Selection — Fix Missing UI
**File:** `src/components/BottomActionBar.tsx`
- The captain selector already exists in the bottom bar but may not render if `starters.length === 0` (the bar is conditionally shown). The real issue: the bottom bar only shows when `starters.length > 0` — this is correct. Check if `captainId` defaults to 0 and the `Select` doesn't show a value for 0.
- Fix: ensure `captainId` is initialized from `roster.captain_id` and the Select shows "Select captain" placeholder when 0

### 4. "Best Captain" → "Captain of the Week" + Rich Display
**Files:** `src/components/RosterSidebar.tsx`, `supabase/functions/ai-coach/index.ts`

**Sidebar changes:**
- Rename button label from "Best Captain Today" → "Captain of the Week"
- Replace `Captain: #{captainResult.captain_id}` with a rich display: player photo (circular), name, team, salary
- Need to resolve `captain_id` to a player object using the `allPlayers` data — pass `allPlayers` as a prop to `RosterSidebar`

**Edge function changes:**
- Update the `pick-captain` schema description prompt to say "captain of the week" and optimize for the entire gameweek, not just one day
- No schema changes needed (still returns `captain_id`)

### 5. "Suggest 3 Moves" Error Fix
**File:** `src/lib/contracts.ts`
- The error is `"Array must contain at least 1 element(s)"` on `data.moves` — the Zod schema has `.min(1)` on the moves array
- When the AI determines no moves are needed, it returns an empty array, which fails validation
- **Fix:** Change `z.array(AISuggestTransferMoveSchema).min(1).max(5)` → `z.array(AISuggestTransferMoveSchema).max(5)` (remove `.min(1)`)
- Also handle empty moves gracefully in `RosterSidebar.tsx` — show "No moves suggested" message

### 6. Transactions Page Fixes
**File:** `src/pages/TransactionsPage.tsx`

**a) Sort not working:**
The `sort` state is set but never applied to the `filtered` array. Add sorting logic:
```
const sortFn = { fp5: p => p.last5.fp5, salary: p => p.core.salary, value5: p => p.computed.value5, ... }
items.sort((a, b) => sortFn[sort](b) - sortFn[sort](a));
```

**b) Sortable column headers (Salary, FP5, Value5, Last FP):**
- Make these 4 `TableHead` cells clickable — clicking sets the `sort` state
- Active sort header gets `font-bold` class, no arrows
- Default sort direction: highest first

**c) Remove "Waiver Mode" toggle:**
- Delete the `waiverMode` state, the `Switch` component, and the filter logic that limits to top 25

**d) Max Salary default:**
- Initialize `maxSalary` from `maxSalaryLimit` (computed from actual player data) instead of hardcoded 999
- Use `useEffect` to sync: when `maxSalaryLimit` changes and `maxSalary > maxSalaryLimit`, reset to `maxSalaryLimit`

### Files Changed

| File | Change |
|------|--------|
| `src/pages/RosterPage.tsx` | Add chips buttons, deadline countdown timer, pass allPlayers to sidebar |
| `src/components/BottomActionBar.tsx` | Ensure captain select works properly |
| `src/components/RosterSidebar.tsx` | Rename to "Captain of the Week", rich captain display with photo/name/team/$ |
| `src/lib/contracts.ts` | Remove `.min(1)` from suggest-transfers moves array |
| `supabase/functions/ai-coach/index.ts` | Update pick-captain prompt to "captain of the week" |
| `src/pages/TransactionsPage.tsx` | Fix sort logic, sortable headers, remove waiver mode, fix max salary default |

### Implementation Order
1. Fix contracts `.min(1)` (unblocks Suggest 3 Moves)
2. Fix TransactionsPage (sort, waiver mode removal, max salary)
3. Update RosterSidebar (captain of the week + rich display)
4. Update ai-coach edge function prompt
5. Add chips UI + countdown timer to RosterPage

