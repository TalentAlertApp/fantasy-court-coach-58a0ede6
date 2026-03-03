

## Problem Analysis

Both **Quick Sync** and **Full Sync** complete in ~13s with `source: "sheet"` and all player stats at zero. The root cause chain:

1. **NBA API timeout too aggressive (12s)** — The Python script uses 35-60s timeouts. The edge function's 12s limit triggers `AbortError` → `NbaBlockedError` → instant sheet fallback. The NBA API likely needs 15-25s to respond.

2. **Sheet fallback returns incomplete data** — The Google Sheet has some user-entered columns (salary, name, team) but the stats columns (PTS, REB, AST, GP, etc.) and last game columns (AI:AS) appear empty because the Python Colab script hasn't been run recently to populate them. Result: 521 players with zeroed stats, 0 last games.

3. **No `games` or `player_last_game` rows** — Both tables are completely empty in the DB.

## Plan

### 1. Increase NBA API timeout from 12s to 25s

**File**: `supabase/functions/_shared/nba-stats.ts`

The edge function has a 60s wall clock. A 25s timeout per request (with 2 attempts max) still fits within budget and matches what the Python script uses (~30-35s). This should allow NBA API responses to actually come through instead of always falling back to sheets.

### 2. Add diagnostic logging to sheet fallback

**File**: `supabase/functions/nba-sync/index.ts`

Add `console.log` for the first data row's raw values and the total column count per row, so we can see exactly what the sheet returns. Also log how many last game rows pass the `game_date` filter vs. how many were filtered out.

### 3. Split FULL sync into two sequential edge function calls

The FULL sync tries to make 4+ NBA API calls (PerGame, GameLog player, GameLog team, etc.) which can exceed the edge function's compute budget. Instead:

**File**: `supabase/functions/nba-sync/index.ts`

- For `FULL` type: run only `PERGAME_LAST5` first. If successful via NBA API, return a response indicating the client should follow up with a `LAST_GAME` call.
- **File**: `src/components/layout/SplitSyncButton.tsx` — When user clicks "Full Sync", chain two requests: first `PERGAME_LAST5`, then `LAST_GAME`, showing progress for each step.

### 4. Ensure sheet fallback handles the case where Python script hasn't been run

**File**: `supabase/functions/nba-sync/index.ts`

Add a check: if the sheet returns rows but all stats columns (GP, PTS, REB, etc.) are zero for the first 10 rows, log a warning `"Sheet appears to have no stats data — Python script may need to be run"` and add it to the `errors` array so the UI shows it.

### Files Modified (3)

1. `supabase/functions/_shared/nba-stats.ts` — increase `REQUEST_TIMEOUT_MS` from 12000 to 25000
2. `supabase/functions/nba-sync/index.ts` — add diagnostic logging to sheet fallback; add empty-stats detection warning
3. `src/components/layout/SplitSyncButton.tsx` — chain Full Sync as two sequential calls (`PERGAME_LAST5` then `LAST_GAME`) with per-step progress labels

