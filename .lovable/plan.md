

## Plan: Fix Schedule Sync to Include Past Games + Add "Today" Button

### Root Cause

The schedule sync function in `supabase/functions/sync-sheet/index.ts` (line 433) filters OUT games with status "finished" or "final":

```typescript
return gameId && !playerId && status !== "finished" && status !== "final";
```

This means only future/scheduled games get synced — past weeks (1-20) are excluded because they have status "finished". The edge function and frontend work correctly; the data simply isn't in the DB.

### Changes

#### 1. `supabase/functions/sync-sheet/index.ts` — Include finished games

- Remove the `status !== "finished" && status !== "final"` condition from the schedule row filter
- Map the actual status from the sheet (e.g., "Finished" → "FINAL") instead of hardcoding "SCHEDULED"
- Map actual scores (`home_pts`, `away_pts`) from the sheet instead of hardcoding 0

#### 2. `src/pages/SchedulePage.tsx` — Add "Today" button

- Add a "Today" button next to the Week/Day selectors
- On click, resets `gw` and `day` to the values computed by `getInitialWeekDay()` (current date lookup)
- Disable the button when already on today's week/day

### Files Modified (2)

1. **`supabase/functions/sync-sheet/index.ts`** — Remove finished-game filter, map real status + scores
2. **`src/pages/SchedulePage.tsx`** — Add "Today" button

### Post-Deploy

Redeploy `sync-sheet`, then re-sync from Commissioner page. All ~1200+ games (past + future) should appear.

