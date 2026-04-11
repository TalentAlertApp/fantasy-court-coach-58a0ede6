

## Plan

### 1. Team of the Week Modal Improvements
**File:** `src/components/TeamOfTheWeekModal.tsx`

- **Wire player cards to PlayerModal**: Add state for `selectedPlayerId`, wrap each `TOTWCard` with an `onClick` that sets it. Render `<PlayerModal>` at the bottom of the component.
- **Photo surge on hover**: Add `transition-transform duration-200 hover:scale-110` to player photo `<img>` elements.
- **FP color fix**: Replace `text-accent` (yellow) with `text-emerald-400` or `text-white font-bold` for readability on the court background.

### 2. Fix Playing Time Trends (empty data)
**File:** `src/hooks/usePlayingTimeTrends.ts`

The root cause: Supabase client has a default 1000-row limit, but there are ~26K game logs. The query only fetches the first 1000 rows, which may not cover enough players or recent data.

**Fix**: Use a server-side aggregation approach via Supabase RPC or paginate through all logs. Simplest fix: paginate with multiple requests using `.range(from, to)` in batches of 1000 until all rows are fetched. Alternatively, create a database function that does the aggregation server-side (more efficient).

**Approach — paginated fetch**:
- Fetch logs in batches of 1000 using `.range(offset, offset+999)` in a loop until the returned count < 1000
- This ensures all 26K rows are processed client-side
- Keep the existing aggregation logic

### 3. Player Comparison Modal
**New file:** `src/components/PlayerCompareModal.tsx`

- Opens from PlayerModal — add a "Compare" button (bar-chart icon + "COMPARE" text) in the player header area, similar to the reference image
- The modal has a search input to find another player, fetches their detail via `fetchPlayerDetail`
- Displays side-by-side comparison using the Stats tab data (Full Season Stats): FP/G, MPG, PTS, REB, AST, STL, BLK, Value, Stocks, Delta FP
- Each stat row highlights which player is higher
- Uses same dark theme styling

**File:** `src/components/PlayerModal.tsx`
- Add a "Compare" button in the header next to the player name
- State to open `PlayerCompareModal`

### 4. Wishlist Feature
**New file:** `src/hooks/useWishlist.ts`
- Stores wishlist as an array of player IDs in localStorage (key: `nba_wishlist`)
- Provides `addToWishlist(id)`, `removeFromWishlist(id)`, `isInWishlist(id)`, `wishlistIds` 
- No database table needed — client-only feature

**File:** `src/components/PlayerModal.tsx`
- Add a Star/Bookmark icon button in the header that toggles wishlist membership

**File:** `src/components/TeamOfTheWeekModal.tsx`
- Add wishlist toggle icon on each TOTW card

**File:** `src/pages/RosterPage.tsx`
- Add a Wishlist icon button in the page header, right after the AI Coach button
- Clicking opens a small popover/dialog listing wishlisted players

**New file:** `src/components/WishlistModal.tsx`
- Shows all wishlisted players with name, team, photo, and remove button
- Click a player to open PlayerModal

### 5. My Roster Card Improvements

**File:** `src/components/PlayerCard.tsx`

**Court variant changes:**
- Increase player name font: `text-[10px]` → `text-xs` (12px)
- Increase photo size: `w-12 h-12` → `w-14 h-14`
- Increase team logo: `w-4 h-4` → `w-5 h-5`
- Increase FC/BC badge: `text-[7px]` → `text-[8px]`, `h-3.5` → `h-4`
- Increase salary text: `text-[8px]` → `text-[9px]`

**Bench variant changes:**
- Add player name (formatted as `I.LASTNAME`) in a bigger font (`text-xs font-bold`)
- Remove the 3-letter team name text (keep only the team badge/logo)
- Increase opponent badges

### 6. Move ROSTER INFO below bench

**File:** `src/components/RosterCourtView.tsx`
- Include `RosterSidebar` as part of the bench column, positioned below the last bench player
- Pass roster info props through to `RosterCourtView`

**File:** `src/pages/RosterPage.tsx`
- Remove the separate `<RosterSidebar>` rendered below the court
- Pass sidebar props to `RosterCourtView` so it renders ROSTER INFO below the bench stack

### Files Summary

| File | Change |
|------|--------|
| `src/components/TeamOfTheWeekModal.tsx` | Wire to PlayerModal, photo hover surge, fix FP color |
| `src/hooks/usePlayingTimeTrends.ts` | Paginate fetches to get all 26K rows |
| `src/components/PlayerCompareModal.tsx` | New — side-by-side player stat comparison |
| `src/components/PlayerModal.tsx` | Add Compare button + Wishlist toggle |
| `src/hooks/useWishlist.ts` | New — localStorage-based wishlist |
| `src/components/WishlistModal.tsx` | New — list wishlisted players |
| `src/pages/RosterPage.tsx` | Add Wishlist icon in header, move ROSTER INFO props to RosterCourtView |
| `src/components/PlayerCard.tsx` | Enlarge court card elements, add name to bench, remove tricode from bench |
| `src/components/RosterCourtView.tsx` | Render ROSTER INFO below bench |

