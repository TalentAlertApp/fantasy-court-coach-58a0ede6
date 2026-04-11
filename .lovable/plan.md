

## Plan: Restore .env and Fix Build Error

### 1. Recreate `.env` file
The `.env` file is missing after the branch switch. Recreate it with the Supabase credentials:
```
VITE_SUPABASE_PROJECT_ID="jtewuekavaujgnynmpaq"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZXd1ZWthdmF1amdueW5tcGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzE2MTcsImV4cCI6MjA4ODEwNzYxN30.ooXNRN9p2EKJlnGNph6NXIZ9xw3QZQqyjKdBxFagroU"
VITE_SUPABASE_URL="https://jtewuekavaujgnynmpaq.supabase.co"
```

### 2. Fix TypeScript build error in `supabase/functions/ai-coach/index.ts`
Line 210: `new Set(ctx.roster.map((r: any) => r.player_id))` produces `Set<unknown>`. Add explicit typing: `new Set<number>(...)` so it matches the `buildPlayerSummary` signature expecting `Set<number>`.

### Files
| File | Change |
|------|--------|
| `.env` | Create with Supabase credentials |
| `supabase/functions/ai-coach/index.ts` | Line 210: `new Set<number>(...)` |

