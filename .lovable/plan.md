

## Plan: Fix Top Players Strip + Schedule Grid Filtering + Linking

### 1. TopPlayersStrip — Query actual game-day FP from `player_game_logs`
**File:** `src/components/TopPlayersStrip.tsx`

The current approach fetches season-average FP from the players API, which is wrong. The strip should show players who actually scored the highest FP on that specific day.

**New approach:**
- Get game IDs for the selected day from `weekGames` (filter by `g.day === day` AND `g.status === "Final"`)
- If no Final games exist for that day → return `null` (hides strip entirely)
- Query `player_game_logs` joined with `players` for those game IDs, ordered by `fp DESC`, limit 10 per position
- Join with `players` table to get `fc_bc`, `name`, `photo`, `team`
- Display actual `fp` from `player_game_logs` (not season average)
- Create a new Supabase query inside the component (or a small hook) that fetches: `player_game_logs` rows where `game_id IN (...)`, joined to `players` for `fc_bc`/`name`/`photo`/`team`

**Layout fix (no scrolling):**
- Remove `min-w-[140px]` from each player card → reduce to `min-w-0`
- Reduce gaps between players, use tighter spacing (`gap-0.5`, smaller padding)
- Use `flex-1` or `flex-shrink` so players compress to fit without scrolling

**Player name linking:**
- Wrap player name in a clickable element that opens `PlayerModal` (add state for `selectedPlayerId` and render `<PlayerModal>`)

### 2. ScheduleGridPage — AND logic for day filters
**File:** `src/pages/ScheduleGridPage.tsx`

Current `isTeamVisible` uses OR logic (`if (dayMap.has(d)) return true`). Change to AND logic:

```typescript
const isTeamVisible = (tricode: string) => {
  if (!hasFilter) return true;
  const dayMap = teamGrid.get(tricode);
  if (!dayMap) return false;
  for (const d of selectedDays) {
    if (!dayMap.has(d)) return false; // must play on ALL selected days
  }
  return true;
};
```

### 3. ScheduleGridPage — Wire team names to TeamModal
**File:** `src/pages/ScheduleGridPage.tsx`

- Add state `selectedTeam` and render `<TeamModal>` at bottom
- Make team tricode in the first column clickable → sets `selectedTeam`

### Files

| File | Change |
|------|--------|
| `src/components/TopPlayersStrip.tsx` | Rewrite to query `player_game_logs` for actual game-day FP; hide when no Final games; tighter layout; link player names to PlayerModal |
| `src/pages/ScheduleGridPage.tsx` | AND filter logic; wire teams to TeamModal |

