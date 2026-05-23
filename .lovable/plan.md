## Plan

1. **Stop the New Team flow from bouncing back to Pick Your Team**
   - Update the app-level auth gate so `/welcome` with `forceNewTeam` is treated as an intentional onboarding flow, not as a returning-user session that needs the team picker.
   - Keep the existing picker behavior for normal login: returning users still land on Pick Your Team until they choose a team.
   - Ensure both entry points work:
     - `+ New Team` from `/welcome/pick-team`
     - `+ New Team` from the sidebar team pill

2. **Preserve the Name Your Franchise screen while creating a new team**
   - Adjust the onboarding redirect/render guards so they do not show a loader or redirect when `forceNewTeam` is active.
   - Avoid changing draft/team creation logic, league selection, or roster rules.

3. **Center and tighten the login league logo row**
   - Update `AuthPage` only.
   - Put the NBA, WNBA, and EuroLeague logos in a centered fixed-width logo strip so the group aligns visually with the `FANTASY` heading.
   - Reduce horizontal spacing between the logos/separators while keeping the existing “no containers” visual style.

## Technical notes

- Files to change:
  - `src/components/auth/RequireAuth.tsx`
  - `src/pages/OnboardingPage.tsx` if needed for the final guard
  - `src/pages/AuthPage.tsx`
- No database or Supabase function changes.
- No change to the earlier logo-container request for league picker cards.