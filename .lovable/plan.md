## Problem

The sidebar "New Team" item in `TeamSwitcher` opens an inline modal that:
1. Creates the team via `createTeam()` with only `name` + `league_code` — no roster is drafted.
2. Calls `setSelectedTeamId(newTeam.id)` but the pill's `<Select>` filters by `teamsInSelectedLeague` (or by sport fallback). If the user creates a WNBA team while an NBA league is active, the new team is not in that list — pill shows nothing/old value. The new team only appears at `/scoring` LEAGUE tab.
3. Clicking the new team in the Scoring table sends user to `/roster` with no roster (never drafted).

The existing `/welcome` onboarding already handles the full flow correctly for `forceNewTeam` (Name → League → Draft) — same flow used by `TeamPickerPage`'s "New Team" button. We should reuse it.

## Fix

### 1) `src/components/TeamSwitcher.tsx`
- Remove the inline Create-Team `<Dialog>` and all related state (`createOpen`, `newName`, `newLeague`, `creating`, `handleCreate`).
- Replace the `__new__` `SelectItem` handler with `navigate("/welcome", { state: { forceNewTeam: true } })`.
- Keep the `?newTeam=1` query-param entry point but redirect it the same way (preserve `sport` if present via `state.preselectSport`, optional — current behavior just preselects league code in the modal; safe to drop since the onboarding flow asks for league again).
- Keep Rename and Delete dialogs as-is.

### 2) `src/pages/OnboardingPage.tsx` (small reinforcement)
- After the Draft step completes for a `forceNewTeam` session, the existing success path already calls `setSelectedTeamId(newTeamId)` + invalidates `["teams"]` and routes to `/roster`. Verify this path also runs for sidebar-initiated runs (no code change expected — same `forceNewTeam` flag).

### 3) No backend changes
- `teams` POST already creates the team; the onboarding `DraftStep` then populates the roster via existing endpoints. No edge-function or schema work required.

## Result
Clicking "New Team" in the sidebar pill takes the user to `/welcome` → NameStep → ChooseLeagueStep → DraftStep. On finish, the new team is selected, has a roster, and appears in the pill list (because TeamContext reconciles the fantasy league to match the new team's sport when origin = "team").

## Files to edit
- `src/components/TeamSwitcher.tsx`
