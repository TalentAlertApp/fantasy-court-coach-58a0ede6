
Goal: restore a clean build, make the roster/scoring routes reliably load the correct team data, and remove the hidden causes of “empty” states.

What will be fixed

1. Repair the build error in `src/components/ScheduleList.tsx`
- Close the `UpcomingGamePreview` component properly before `export default function ScheduleList(...)`.
- Re-check the JSX/function brace balance around lines 518–594 so the file is a valid module again.
- This is the direct cause of the current Vite/esbuild failure.

2. Fix the team-selection issue causing empty roster/scoring pages
- The database currently has 2 fantasy teams, but only the first/default team has roster rows.
- `TeamContext` keeps any valid `localStorage` team id, even if that team has no roster, so the app can stay pointed at an empty team forever.
- I will update the startup selection logic so the app prefers a team that actually has roster data when restoring state, instead of blindly reusing a stale empty team.
- I will preserve manual team switching, so this only corrects stale startup state rather than fighting the user.
- I will add a clearer empty-state path for teams that truly have no roster yet.

3. Fix the scoring edge function bug
- In `supabase/functions/scoring-history/index.ts`, starter detection is checking `slot === "starter"` while roster rows are saved as `"STARTER"` / `"BENCH"`.
- I will normalize slot comparisons to be case-insensitive.
- This will restore the starting-5 indicators and prevent scoring from misclassifying every player as bench.

4. Harden roster/player loading so it does not fail on partial player fetches
- The app currently asks `players-list` for `limit: 500`, but the database contains 592 players.
- That means a valid roster can become partially or fully invisible if its players fall outside the first 500 rows.
- I will remove that fragility by either:
  - increasing the effective player fetch ceiling for roster-dependent screens, or
  - fetching any missing roster players by id.
- This makes the roster page resilient “for good,” even as salaries/rankings change.

5. Align API responses and empty states
- Keep `scoring-history` response shape consistent even when a team has no roster.
- Ensure `/scoring` and `/` show an intentional empty state for genuinely empty teams instead of looking broken.
- If helpful, surface which team is selected when no roster is found.

Files likely involved
- `src/components/ScheduleList.tsx`
- `src/contexts/TeamContext.tsx`
- `src/hooks/useRosterQuery.ts`
- `src/hooks/useScoringHistory.ts`
- `src/pages/RosterPage.tsx`
- `src/pages/ScoringPage.tsx`
- `src/hooks/usePlayersQuery.ts`
- `supabase/functions/scoring-history/index.ts`
- `supabase/functions/teams/index.ts` or another lightweight team-meta path if needed

Technical details
- Root cause 1: syntax break in `ScheduleList.tsx` from a missing closing brace/function boundary.
- Root cause 2: stale persisted `selectedTeamId` can point to the second team, which has zero roster rows.
- Root cause 3: `scoring-history` uses lowercase slot checks against uppercase stored slot values.
- Root cause 4: roster screens rely on a capped 500-player fetch while the database has 592 players.

Verification after implementation
- Build completes without the `Unexpected "export"` error.
- `/schedule` renders again.
- With the currently empty team id stored in `localStorage`, the app recovers to a team with data instead of showing blank roster/scoring pages.
- `/` shows the 10 current roster players for the populated team.
- `/scoring` shows historical rows and the starter strip correctly marks starters.
- Empty teams still display a clean, explicit empty state.
