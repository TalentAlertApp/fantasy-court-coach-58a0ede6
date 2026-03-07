

## Plan: Fix Schedule Display, Replace Players with Database.csv, Add Pagination

### Issue 1: Schedule tab is empty despite 254 games synced

**Root cause**: The `schedule` edge function (`supabase/functions/schedule/index.ts`) is hardcoded to return `{ games: [] }`. It never reads from `schedule_games` table. The sync correctly upserts 254 rows into `schedule_games`, but the API ignores them.

**Fix**: Rewrite `supabase/functions/schedule/index.ts` to query the `schedule_games` table, filtering by `gw` and `day` parameters. Return results in the existing `SchedulePayloadSchema` format.

### Issue 2: Players data (e.g., Cam Thomas at Brooklyn) is stale

**Root cause**: The `players-list` edge function reads from the Google Sheet (mode=`"sheet"`) by default, not from Supabase. The `import-players` function upserts bio data to Supabase, but `players-list` ignores it because `DATA_SOURCE_MODE` defaults to `"sheet"`.

**Fix** (two parts):

A. **Set `players-list` to always read from Supabase** — Remove the `"sheet"` mode branch entirely from `supabase/functions/players-list/index.ts`. The function should only query the `players` table + `player_last_game` table. This makes the CSV-imported data (Database.csv) the source of truth.

B. **Delete stale players not in Database.csv** — The `import-players` edge function currently only upserts. Add an option (`replace: true`) so that after upserting all CSV players, it deletes any players from the `players` table whose IDs are NOT in the uploaded CSV. This ensures old/stale players (like Cam Thomas showing Brooklyn from the sheet) are removed. The Commissioner page will send `replace: true` to signal a full replacement.

### Issue 3: Add pagination to /players

**Fix**: Add client-side pagination to `PlayersPage.tsx`:
- State for `page` (default 1) and `pageSize` (default 20, options: 10, 20, 30, 50, All)
- After filtering, slice the `filtered` array by page/pageSize
- Render pagination controls below the tables (Previous/Next + page indicator + pageSize selector)
- Use existing `Pagination*` UI components from `src/components/ui/pagination.tsx`

### Files Modified (4)

1. **`supabase/functions/schedule/index.ts`** — Rewrite to query `schedule_games` table by gw/day
2. **`supabase/functions/players-list/index.ts`** — Remove sheet mode; Supabase-only reads
3. **`supabase/functions/import-players/index.ts`** — Add `replace: true` option to delete players not in the uploaded set
4. **`src/pages/PlayersPage.tsx`** — Add pagination with page size selector (10/20/30/50/All)

### Deployment

Deploy updated edge functions: `schedule`, `players-list`, `import-players`. After deployment, user should re-upload Database.csv from Commissioner page (with replace mode) to clean up stale players.

