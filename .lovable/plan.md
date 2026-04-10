

## Plan: Fix 4 Issues

### 1. Add Player modal scrolling
**File:** `src/components/PlayerPickerDialog.tsx`
- The `ScrollArea` already has `max-h-[55vh]` and `flex-1 min-h-0`. The issue is likely that `DialogContent` uses `max-h-[80vh]` with `flex flex-col` but the content overflows. Change the `ScrollArea` to use `overflow-y-auto` directly or ensure the dialog properly constrains height. Verify the `flex-1 min-h-0` pattern works with the dialog's grid layout by adding `overflow-hidden` to `DialogContent`.

### 2. PlayerModal stuck/empty when opened from /players
**Root cause:** The `player-detail` edge function returns `season: {gp, mpg, pts, reb, ast, stl, blk, fp}` WITHOUT the `total_*` fields. But `PlayerSeasonSchema` (used by both `players-list` and `player-detail` via shared `PlayerListItemSchema`) now requires `total_mp`, `total_pts`, etc. with `.strict()`. Zod rejects the response silently.

**Fix (two-pronged):**
- **`src/lib/contracts.ts`**: Make the 7 `total_*` fields optional (`.optional().default(0)`) in `PlayerSeasonSchema` so both endpoints work
- **`supabase/functions/player-detail/index.ts`**: Alternatively/additionally, add `total_*` fields computed from the history data. But making them optional is the simplest fix.

### 3. /players table layout tweaks
**File:** `src/pages/PlayersPage.tsx`

**a) FC/BC badge after photo**: Move the `Badge` from after the name to directly after the `Avatar`, before the name text.

**b) Circular player photo with hover surge**: Change `Avatar` from `h-5 w-5` to `h-7 w-7 rounded-full` (already circular by default). Add `transition-transform group-hover:scale-110` to the Avatar. Wrap the row or cell in a `group` class.

**c) GP = total games since season start**: The current code shows `p.season.gp` which comes from the edge function aggregating `player_game_logs WHERE mp > 0`. This IS the total since start of season. If the user means ALL games (including DNP), this needs a different query. Most likely the current behavior is correct — GP counts games where the player actually played (mp > 0). No code change needed unless the edge function logic is wrong.

### 4. Delete Stats tab
**Files:** `src/App.tsx`, `src/components/layout/AppLayout.tsx`, `src/pages/StatsPage.tsx`
- Remove the `/stats` route from `App.tsx`
- Remove the "Stats" nav item from `AppLayout.tsx`
- Delete `src/pages/StatsPage.tsx`

---

### Files Changed

| File | Change |
|------|--------|
| `src/lib/contracts.ts` | Make `total_*` fields optional with `.default(0)` |
| `src/pages/PlayersPage.tsx` | Move FC/BC badge after photo; circular avatar with hover surge |
| `src/components/PlayerPickerDialog.tsx` | Ensure scroll works (add `overflow-hidden` to DialogContent) |
| `src/App.tsx` | Remove `/stats` route |
| `src/components/layout/AppLayout.tsx` | Remove "Stats" nav item |
| `src/pages/StatsPage.tsx` | Delete file |

### Implementation Order
1. Fix `contracts.ts` (unblocks PlayerModal)
2. PlayersPage layout tweaks
3. PlayerPickerDialog scroll fix
4. Remove Stats tab

