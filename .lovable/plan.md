

## Plan: Sheet-Only Sync (Python Colab → Google Sheet → Supabase)

### Feasibility Assessment

**Part 1 (Sheet → Supabase): Fully doable.** The existing `sheetFallbackSync` in `nba-sync` already does this. We just need to make it the primary (and only) sync path.

**Part 2 (Trigger Colab from the app): Not possible.** Google Colab has no public API to trigger notebook execution programmatically. The workflow will be:
1. User manually runs the Python script in Colab (populates the Google Sheet)
2. User clicks "Sync" in the app (reads Sheet → upserts to Supabase)

### Changes

#### 1. Simplify `nba-sync` edge function — Sheet-only

**File**: `supabase/functions/nba-sync/index.ts`

Strip out all NBA API direct-fetch logic (`syncPerGameAndLast5`, `syncLastGame`, `NbaBlockedError` handling). The function becomes:
- Accept POST with `{ type: "SHEET" }` (or any type — all map to sheet sync)
- Call the existing `sheetFallbackSync` logic directly as the primary path
- Create a `sync_runs` record, upsert players + last games from sheet, mark done
- Source is always `"sheet"`

This eliminates all NBA API calls, timeouts, and `WORKER_LIMIT` issues entirely. The function will complete in 3-5 seconds.

#### 2. Fix sheet tab targeting using `GSHEET_GID`

The Google Sheets API needs the sheet name in the range to target a specific tab. Currently the code doesn't use `GSHEET_GID` (which is already set as a secret). We'll resolve the tab name from the GID by fetching spreadsheet metadata first, or use the sheet name directly from the Python script config (`"2025-26"` equivalent).

Alternative simpler approach: fetch using `gid` parameter isn't supported by the values API, but we can get the sheet title via the spreadsheet metadata endpoint and prepend it to the range.

#### 3. Simplify the UI — single "Sync from Sheet" button

**File**: `src/components/layout/SplitSyncButton.tsx`

Replace the Quick Sync / Full Sync split with a single "Sync" button. No dropdown needed since there's only one sync mode now.

**File**: `src/components/layout/AppLayout.tsx`

Simplify `handleSync` to just call `triggerSync({ type: "SHEET" })`. Remove the two-phase sequential chain.

#### 4. Update `triggerSync` API contract

**File**: `src/lib/api.ts` and `src/lib/contracts.ts`

Update the `type` parameter to accept `"SHEET"` instead of `"FULL" | "PERGAME_LAST5" | "LAST_GAME"`.

### Files Modified (4)
1. `supabase/functions/nba-sync/index.ts` — gutted to sheet-only sync
2. `src/components/layout/SplitSyncButton.tsx` — single Sync button
3. `src/components/layout/AppLayout.tsx` — simplified handleSync
4. `src/lib/api.ts` — updated triggerSync type

