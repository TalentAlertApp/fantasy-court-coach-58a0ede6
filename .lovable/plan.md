
## 1. EuroLeague watermark on Step 3 (DraftPicker)

`DraftPicker` already renders a top-right watermark from `getLeagueLogo(leagueCode)`. The bug is that `pendingMainSport` (passed as `leagueCode`) defaults to `"nba"` whenever the draft step is reached without going through `handleNameSubmit` in this render — namely when the user resumes a persisted `step: "draft"`, or in the brief window before `pendingMainSport` is set.

Fix in `src/pages/OnboardingPage.tsx`:
- Persist the chosen sport alongside the step in `setOnboardingState` (extend `OnboardingState` in `onboarding-store.ts` with optional `sport`).
- On hydrate, seed `pendingMainSport` from the persisted state, or from `teams.find(t => t.id === createdTeamId)?.league_code` when resuming `step === "draft"`.
- Pass `leagueCode={selectedTeam?.league_code ?? pendingMainSport}` to `<DraftStep>` so the watermark always reflects the actual team's league.

## 2. EuroLeague manual-pick shows NBA players

`usePlayersQuery` keys on `useLeague().league`, which resolves from `selectedTeam?.league_code`. Right after `createTeam` the team is not yet in the `["teams"]` cache, so `selectedTeam` is null and the hook falls back to the previously active league (NBA).

Fix in `src/pages/OnboardingPage.tsx` `submitTeam`:
- Replace `invalidateQueries({queryKey:["teams"]})` with `await queryClient.refetchQueries({ queryKey: ["teams"] })` BEFORE calling `setStep("draft")`. Same for `fantasy-leagues`.
- Defensive: also call `setSelectedLeagueId(mainLeagueIdForSport(args.leagueCode))` via `useFantasyLeague` so the fantasy-league context (and any league-derived queries that resolve before `selectedTeam` populates) immediately match the new sport.

## 3 & 4. Bounce from Name Franchise back to Pick Your Team

Root cause: `forceNewTeam` lives only in `location.state`. Any re-navigation inside the onboarding flow (or a router state reset) drops it; once dropped, the `useEffect` at `OnboardingPage.tsx:143-150` sees `!forceNewTeam` + `!shouldOnboard` + ≥1 owned team and redirects to `/welcome/pick-team`.

Fix:
- Add a session-scoped `creatingNewTeam` flag in `src/lib/onboarding-store.ts` (sessionStorage helpers: `setCreatingNewTeam`, `isCreatingNewTeam`, `clearCreatingNewTeam`).
- `TeamPickerPage.handleCreateNew` and `TeamSwitcher` "New Team" buttons set the flag before navigating to `/welcome`.
- `OnboardingPage` treats `forceNewTeam = navState?.forceNewTeam === true || isCreatingNewTeam()` so the flag survives re-renders / state resets.
- Clear the flag in `handleFinish`, `handleSignOut`, `handleSkip`, and on successful `handleDraftBack` to picker.
- Also gate the two `pick-team` redirect `useEffect`s on the flag, not just `forceNewTeam`.

This is the same pattern already used for `markTeamPickedThisSession` and removes the fragile dependency on `location.state`.

## 5. Auth-screen league logos not centered

In `src/pages/AuthPage.tsx`, the three logos use `w-auto` with very different intrinsic widths (NBA is narrow vertical, WNBA medium, EuroLeague square basketball), so the separators sit at non-symmetric positions relative to the "FANTASY" title below.

Fix: wrap each `<img>` in a fixed-width centering box so each logo cell is identical:

```tsx
<div className="flex h-12 w-14 items-center justify-center">
  <img src={…} className="max-h-12 max-w-full object-contain" />
</div>
```

Use the same cell width for all three logos and keep the `h-7 w-px` dividers between them. The whole row remains `flex justify-center gap-2.5`, but now each slot occupies the same horizontal space → separators land at perfectly symmetric positions under the "FANTASY" heading.

## Files touched

- `src/pages/OnboardingPage.tsx` (issues 1, 2, 3, 4)
- `src/lib/onboarding-store.ts` (extend state, add `creatingNewTeam` session helpers)
- `src/pages/TeamPickerPage.tsx` (set `creatingNewTeam` flag)
- `src/components/TeamSwitcher.tsx` (set `creatingNewTeam` flag on both "New Team" entry points)
- `src/pages/AuthPage.tsx` (logo row alignment)

No DB migrations, no edge-function changes.
