

## Fix: nba-sync `.catch()` not a function

### Root Cause
Supabase JS v2 query builder returns a `PromiseLike` (thenable) but lacks `.catch()`. Two locations use `.catch(() => {})`:
- Line 49: `updateStep` helper
- Line 96: error handler fallback

### Fix
Replace `.catch(() => {})` with wrapping in a try/catch, or use `.then(null, () => {})` which works on thenables.

### Files Modified (1)
- `supabase/functions/nba-sync/index.ts`
  - Line 49: Change `.eq("id", runId).catch(() => {})` to `.eq("id", runId).then(null, () => {})`
  - Line 96: Same fix

