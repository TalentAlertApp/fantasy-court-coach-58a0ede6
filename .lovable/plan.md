

## Update Game Data Import: TSV + Full Replace Toggle

### Problem
The game data import card currently parses CSV (comma-separated). The user's data is TSV (tab-separated). Additionally, the first full-season import should wipe existing `schedule_games`, `player_game_logs`, and `player_last_game` tables, but subsequent imports should only append/upsert new games.

### Changes

**1. `src/pages/CommissionerPage.tsx`**
- Change `handleGameDataUpload` parser from `parseCSVLine` (comma-split) to tab-split (`\t`)
- Add a "Full replace" checkbox/toggle (default ON for first import, then user can turn OFF for incremental)
- Pass `replace: true/false` flag to the edge function
- Update file accept to `.tsv,.csv,.txt`
- Update labels from "CSV" to "TSV"

**2. `supabase/functions/import-game-data/index.ts`**
- Accept `replace` boolean from request body alongside `rows`
- When `replace: true`: delete all rows from `schedule_games`, `player_game_logs`, and `player_last_game` before upserting
- When `replace: false` (default): keep existing upsert behavior (new data merges in)
- Redeploy the function

### Files changed
| File | Action |
|------|--------|
| `src/pages/CommissionerPage.tsx` | TSV parsing, add replace toggle, update labels |
| `supabase/functions/import-game-data/index.ts` | Add `replace` flag to wipe tables before import |

