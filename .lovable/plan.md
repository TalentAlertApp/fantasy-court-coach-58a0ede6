
Goal: make data loading deterministic on first preview load so roster, scoring, schedule, and team state do not randomly appear empty until an auto refresh.

What is actually broken
- The current preview snapshot shows frontend requests going to `undefined/functions/v1/...` instead of the real Supabase URL.
- That means some core data loaders are building their endpoint URLs from `import.meta.env.*` values that are not reliably available in this preview runtime.
- When those requests fail, the UI often falls back to “empty” states instead of showing a loading/error state.
- `TeamContext` also clears the saved team selection on transient `teams` query failure, which makes the app look even more broken after one bad bootstrap.

Implementation plan

1. Replace runtime-fragile env access with a single stable Supabase config source
- Stop reading `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` directly inside client fetchers.
- Reuse the already-stable frontend Supabase config from `src/integrations/supabase/client.ts`, or move those constants into a small shared config module and import from there.
- Update:
  - `src/lib/api.ts`
  - `src/hooks/useScoringHistory.ts`
- This removes the root cause behind requests like `undefined/functions/v1/teams`.

2. Harden edge-function fetching so bad responses cannot masquerade as “no data”
- In `apiFetch`, validate that the response is actually JSON before parsing.
- If the response is HTML or otherwise invalid, throw a clear error instead of letting downstream pages behave as if the API returned an empty payload.
- Keep Zod validation, but make transport/runtime failures explicit and early.

3. Make team bootstrap deterministic instead of optimistic
- Refactor `TeamContext` to expose a real readiness signal such as `isReady` / `hasResolvedSelection`, separate from the raw `teams` query loading state.
- Only resolve `selectedTeamId` after the teams fetch has succeeded.
- Preserve the last known `selectedTeamId` during transient `teams` errors instead of immediately wiping localStorage.
- Keep the one-time auto-correction to a populated team, but only run it after successful team initialization.

4. Gate team-scoped queries on team readiness
- Update team-dependent hooks so they do not enter a fake idle/empty state while the active team is still being resolved.
- Specifically update:
  - `src/hooks/useRosterQuery.ts`
  - `src/hooks/useScoringHistory.ts`
- Use `enabled: isTeamReady && !!selectedTeamId` rather than only `!!selectedTeamId`.

5. Replace misleading empty states with loading/error states
- `src/pages/RosterPage.tsx`
  - Show a bootstrap/loading state while team selection is unresolved.
  - Show a retry/error card if data transport fails.
  - Only show “No players on {team} yet” when the roster query succeeded for a valid selected team and truly returned zero players.
- `src/pages/ScoringPage.tsx`
  - Distinguish between “no scoring history exists” and “scoring request failed / team not ready”.
- `src/pages/SchedulePage.tsx`
  - Render a proper error state with retry when schedule fetching fails instead of defaulting to `games={[]}` and showing “No games scheduled”.

6. Tighten refetch behavior to avoid startup churn
- Review `refetchOnMount: "always"` on the teams query and keep it only if it is still needed after the bootstrap cleanup.
- Preserve last successful data during transient refetches where possible, so users do not see the whole app collapse to empty while background refresh happens.

Why this fixes it for good
- The primary failure is not your Supabase data and not a database-side change; it is unstable frontend endpoint construction during preview bootstrap.
- Once all edge-function calls stop depending on missing preview env vars, the app will consistently hit the same Supabase every time.
- Once the UI stops treating failed requests as legitimate empty data, transient network issues will show as recoverable errors instead of fake “no roster / no games / no scoring” states.

Files to update
- `src/integrations/supabase/client.ts` or new shared config module
- `src/lib/api.ts`
- `src/hooks/useScoringHistory.ts`
- `src/contexts/TeamContext.tsx`
- `src/hooks/useRosterQuery.ts`
- `src/pages/RosterPage.tsx`
- `src/pages/ScoringPage.tsx`
- `src/pages/SchedulePage.tsx`

Verification after implementation
- Fresh preview load does not make any request to `undefined/functions/v1/*`.
- Hard reload shows teams, roster, scoring, and schedule immediately without waiting for an auto refresh.
- Temporary API failures show an explicit retry/error state, not a fake empty-state CTA.
- The saved selected team remains stable across transient failures.
- `/schedule` no longer says “No games scheduled” when the day actually has games.
