

## Plan: Data Persistence Fix, UI Polish, and Captain-Per-Week Rule

### 1. Fix: Data not loading after closing/reopening browser

**Root cause**: The `teams` edge function needs to be deployed, but more critically, the `NBAGameModal.tsx` has build errors blocking the entire app from rendering. The TS compilation passes locally, but the build errors in the report suggest a corrupted cached build artifact. Fix: rewrite `NBAGameModal.tsx` with identical content to force a clean rebuild.

Additionally, add `staleTime: Infinity` to critical queries that shouldn't refetch unnecessarily, and ensure `refetchOnMount: "always"` for the teams query so it always loads fresh on app mount.

**File**: `src/components/NBAGameModal.tsx` — rewrite file (same content, forces rebuild)
**File**: `src/contexts/TeamContext.tsx` — add `refetchOnMount: "always"` to teams query

### 2. Team of the Week Modal — increase size

**File**: `src/components/TeamOfTheWeekModal.tsx`
- Change `max-w-2xl` to `max-w-4xl` on DialogContent
- Increase court aspect ratio from `5/3` to `16/9`
- Increase player card width from `w-[18%]` to `w-[22%]`
- Increase photo from `w-12 h-12` to `w-16 h-16`
- Increase player name from `text-[10px]` to `text-sm`
- Increase FP text from `text-[9px]` to `text-xs`
- Increase badge sizes proportionally

### 3. Schedule — Upcoming game expanded card: Conference standings mini-table

**File**: `src/components/ScheduleList.tsx` (`UpcomingGamePreview`)
- For each team in the preview, query `schedule_games` to compute conference standings
- Use `NBA_TEAM_META` to get conference membership
- Compute W/L/PCT/GB for all conference teams, sort by PCT desc
- Find the team's rank, then show 5 teams centered on that rank (handling edges)
- Display mini-table: Rank, team badge, tricode, GP, W, L, PCT, GB
- Wire team badge/name to TeamModal

### 4. Team Modal — wire team names + roster column tooltips

**File**: `src/components/TeamModal.tsx`
- Tabs PLAYED and UPCOMING: opponent team names already clickable — verify wiring to TeamModal (the modal already imports `PlayerModal` but needs to add self-referencing TeamModal for opponent clicks)
- Tab ROSTER: add `title` tooltips to column headers (MPG, PPG, FPG, $)

### 5. Player Modal — fixed height + scrollable tabs + AI Explain bug

**File**: `src/components/PlayerModal.tsx`
- Change `max-h-[85vh]` to a fixed `h-[85vh]` on DialogContent
- Ensure all tab contents use `ScrollArea` with consistent height
- AI Explain tab: the bug where it returns wrong player is already fixed with the autocomplete approach in `AICoachModal.tsx`. The Player Modal's own `handleExplain` sends `player_id` directly, so it should be correct. Verify the explain endpoint logic.

### 6. Wishlist Modal — align FP and $ columns

**File**: `src/components/WishlistModal.tsx`
- Change the FP and salary spans to use fixed `min-w-[48px]` (or `w-[50px]`) with `text-right` to ensure alignment regardless of value format (XX.X)

### 7. Captain once-per-week rule

**File**: `src/pages/RosterPage.tsx`
- Query the `roster` table for the current GW to check if any day already has `is_captain=true`
- If a captain is already set for another day in the same GW, show a warning toast and prevent setting a new captain
- Add a visual indicator showing which day the captain is already set for
- Modify `handleSetCaptain` to check this rule before saving

**File**: `src/hooks/useRosterQuery.ts` or inline query in RosterPage
- Add a query: `SELECT day FROM roster WHERE team_id = X AND gw = Y AND is_captain = true`
- Use result to enforce the "one captain per week" rule

### 8. AI Coach Explain — wrong player bug (Booker/VJ Edgecombe)

**File**: `src/components/AICoachModal.tsx`
- The autocomplete fix was already implemented. However, the injury handler at line 144 extracts `player_id` incorrectly: `rosterData.roster.starters` are plain number arrays, not objects with `.player_id`. Fix: use the IDs directly from the starters/bench arrays instead of mapping `.player_id`

### Files Summary

| File | Changes |
|------|---------|
| `src/components/NBAGameModal.tsx` | Rewrite to clear build cache |
| `src/contexts/TeamContext.tsx` | Add `refetchOnMount: "always"` |
| `src/components/TeamOfTheWeekModal.tsx` | Increase modal/card sizes |
| `src/components/ScheduleList.tsx` | Add conference standings mini-table in upcoming preview |
| `src/components/TeamModal.tsx` | Wire opponent team clicks, roster tooltips |
| `src/components/PlayerModal.tsx` | Fixed height `h-[85vh]`, scrollable tabs |
| `src/components/WishlistModal.tsx` | Fixed-width FP/$ columns for alignment |
| `src/pages/RosterPage.tsx` | Captain once-per-week enforcement with warning |
| `src/components/AICoachModal.tsx` | Fix injury monitor player_ids extraction |

