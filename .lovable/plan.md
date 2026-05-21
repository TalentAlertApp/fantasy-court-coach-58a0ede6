## Plan

1. **Make the sidebar team pill global**
   - Update `TeamSwitcher` so the dropdown always lists every team in `teams`, not only teams matching the currently selected `/scoring` league.
   - Keep the NBA/WNBA logo beside each team so cross-league teams remain clear.

2. **Keep the newly created team selected through onboarding completion**
   - In `OnboardingPage`, after draft completion, explicitly re-set the newly created team as the selected team, invalidate/refetch team + roster queries, and navigate back to `/` only after React Query has the fresh team list.
   - This should remove the “empty pill until hard refresh” state and avoid selecting the team sending the user back to the draft page again.
   - Clear the onboarding state only after successful roster handoff so the app no longer thinks the just-created team is still mid-draft.

3. **Fix the TeamContext reconciliation race**
   - Adjust `TeamContext` so a newly selected team id is not auto-cleared during the small window before the invalidated `teams` query returns the new row.
   - Make readiness/selection reconciliation tolerate a valid pending selection and avoid falling back to an older populated team while onboarding is creating/drafting a new team.

4. **Block duplicate team names for the same user**
   - Add a client-side validation in onboarding name submission (and rename flow) to detect existing same-user team names case-insensitively after trimming whitespace.
   - Add the same server-side validation in the `teams` edge function for both `POST` create and `PATCH` rename so duplicate names are blocked even if the frontend is bypassed.
   - Return a clear validation error like “You already have a team with this name.”

5. **Validate the flow**
   - Run a targeted check of the touched TypeScript files and inspect the updated logic.
   - Verify that: New Team → name/sport → league → draft → `/` keeps the new team selected, the sidebar dropdown shows all user teams, and duplicate names are rejected.