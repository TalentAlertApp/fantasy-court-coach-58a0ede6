

## Fix: Restore Environment Variables and Build Error

### Root Cause
After switching to the `revamp/frontend-layout-v2` branch, the `.env` file is missing. This means `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` resolve to `undefined`, causing all API calls to fail (requests go to `undefined/functions/v1/...`).

Additionally, there's a TypeScript build error where `sidebarProps` is being passed to `RosterCourtView` but the branch version of the component may not accept it.

### Changes

**1. Recreate `.env` file**
Create `.env` with the correct Supabase credentials:
```
VITE_SUPABASE_PROJECT_ID="jtewuekavaujgnynmpaq"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZXd1ZWthdmF1amdueW5tcGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzE2MTcsImV4cCI6MjA4ODEwNzYxN30.ooXNRN9p2EKJlnGNph6NXIZ9xw3QZQqyjKdBxFagroU"
VITE_SUPABASE_URL="https://jtewuekavaujgnynmpaq.supabase.co"
```

**2. Fix build error in `src/pages/RosterPage.tsx`**
Remove the `sidebarProps` prop being passed to `RosterCourtView` at line 387 if the component interface on this branch doesn't support it (or add the prop to the interface if it was intended). Will verify the exact state and fix accordingly.

### Impact
- Restores all API connectivity (players, schedule, roster, teams)
- Fixes the TypeScript build error so the app compiles

