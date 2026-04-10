

## Import 26K Game Data Rows Safely

### Issues to fix

1. **`import-game-data` replace mode currently wipes `schedule_games`** (line 82). Since schedule is now managed by its own import tool, the game data import must stop touching that table. Only `player_game_logs` and `player_last_game` should be wiped on replace.

2. **26,000 rows in one POST** will likely timeout the edge function (60s limit). The client should split into chunks of ~2,000 rows, sending `replace: true` only on the first chunk and `replace: false` on subsequent ones.

### Changes

**`supabase/functions/import-game-data/index.ts`**
- Remove line `await sb.from("schedule_games").delete(...)` from the replace block. Game data import no longer owns the schedule table.

**`src/pages/CommissionerPage.tsx`**
- Update `handleGameDataUpload` to chunk parsed rows into batches of 2,000.
- First batch sends `replace: true` (if toggle is on), subsequent batches send `replace: false`.
- Show progress: "Importing batch 3/13…"
- Final result sums up totals from all batches.

### Files changed
| File | Action |
|------|--------|
| `supabase/functions/import-game-data/index.ts` | Remove schedule_games wipe from replace mode |
| `src/pages/CommissionerPage.tsx` | Chunk game data upload into 2K-row batches with progress |

