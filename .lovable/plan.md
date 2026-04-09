

## Fix: Restore Missing Environment Variables

### Problem
The `.env` file has been deleted/lost. All API calls are going to `undefined/functions/v1/...` with `apikey: undefined`, which returns the Vite HTML page instead of JSON. This is why the app shows 0 players, no schedule data, and empty stats.

### Solution
Recreate the `.env` file with the correct Supabase credentials (these are already public in `src/integrations/supabase/client.ts`):

```
VITE_SUPABASE_PROJECT_ID="jtewuekavaujgnynmpaq"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZXd1ZWthdmF1amdueW5tcGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzE2MTcsImV4cCI6MjA4ODEwNzYxN30.ooXNRN9p2EKJlnGNph6NXIZ9xw3QZQqyjKdBxFagroU"
VITE_SUPABASE_URL="https://jtewuekavaujgnynmpaq.supabase.co"
```

### Files Changed
| File | Action |
|------|--------|
| `.env` | **Create** — restore the 3 Vite env vars |

This single fix will restore all data across every page (players, schedule, stats, roster, etc.).

