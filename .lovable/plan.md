# Fix new-team flow + draft polish

## 1. Remove league capacity & one-team-per-league limits

**Goal** — Each user can create unlimited teams in any league (Main NBA, Main WNBA, or custom). Removes both the "league is full" error and the "you already have a team in this league" 409.

**Changes**:
- `supabase/functions/teams/index.ts`: drop the `teamCount >= max_teams` check in both branches (lines 130–137 for custom fantasy league, lines 148–154 for Main League).
- `supabase/functions/leagues-manage/index.ts` (attach-team): drop the `FULL` check (~line 520) and the `ALREADY_HAS_TEAM` check (~line 531). Allow attaching multiple teams.
- `supabase/functions/leagues-join/index.ts`: drop the `FULL` check (~line 60). (Membership of user is still tracked separately; multiple teams allowed.)
- `src/pages/OnboardingPage.tsx`: simplify the attach-team error handling — remove the `ALREADY_HAS_TEAM` soft-success branch since it's no longer reachable. Keep the direct `fetch` call.

Duplicate-name guard (per user) stays — that's a different rule the user asked for.

## 2. TeamContext guard against clearing selectedTeamId mid-handoff

Symptom: right after team creation, `setSelectedTeamId(newId)` runs and `["teams"]` is invalidated. The auto-correct effect sees `selectedTeamId` not yet in stale `teams`, wipes it, and falls back to another team.

Fix in `src/contexts/TeamContext.tsx`:
- Track `lastSetTeamIdAt` timestamp inside `setSelectedTeamId`.
- In the auto-correct effect, if the selected id is missing from `teams` but was set within the last ~5s, skip the wipe and wait for the next teams refetch.
- Also use `useIsFetching({ queryKey: ["teams"] })` to skip auto-correct while a teams refetch is in flight.

## 3. TeamSwitcher loading/skeleton

In `src/components/TeamSwitcher.tsx`:
- Use `useIsFetching({ queryKey: ["teams"] })`.
- While `isLoading || (isFetching && teams.length === 0)`, render a small skeleton pill matching the trigger size instead of the empty Select.
- When refetching with cached data present, keep the existing pill visible (no flicker).

## 4. DRAFT step league watermark

In `src/components/onboarding/DraftPicker.tsx` (thread `leagueCode` via `DraftStep` + `OnboardingPage` using `pendingMainSport` / selected team `league_code`):
- Absolutely positioned NBA/WNBA logo (via `LeagueLogoBadge` or SVG) in the top-right corner, ~220–280px, `opacity-[0.08]`, blurred slightly, with a soft radial glow behind it tinted with `--primary`.
- Fade-in on mount (`animate-in fade-in zoom-in-95 duration-700`) plus a slow pulse/float using existing Tailwind keyframes.
- Sits below the step indicator and audio toggle (`z-0` watermark, content `z-10`), `pointer-events-none`.

## 5. Validation

- Create two teams under the same user in Main League NBA → both succeed.
- Pill stays populated through onboarding handoff to `/` — no flicker, no fallback.
- DRAFT step shows the correct NBA/WNBA watermark.

## Technical scope

- `supabase/functions/teams/index.ts` — remove capacity checks.
- `supabase/functions/leagues-manage/index.ts` — remove FULL and ALREADY_HAS_TEAM checks in attach-team.
- `supabase/functions/leagues-join/index.ts` — remove FULL check.
- `src/pages/OnboardingPage.tsx` — simplify attach-team error handling.
- `src/contexts/TeamContext.tsx` — recency + isFetching guard.
- `src/components/TeamSwitcher.tsx` — skeleton state.
- `src/components/onboarding/DraftPicker.tsx`, `DraftStep.tsx`, `OnboardingPage.tsx` — thread `leagueCode` and render watermark.
