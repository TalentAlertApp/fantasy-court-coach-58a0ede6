# Fixes

## 1) After drafting a brand new team, go straight to the Court (not Welcome Back)

**Where:** `src/pages/OnboardingPage.tsx` → `handleFinish()` (called when `DraftPicker` finishes).

Today it does:
- `setSelectedTeamId(createdTeamId)`
- `markTeamPickedThisSession()`
- refetch teams + `navigate(returnTo /* "/" */)`

Then `RequireAuth` runs at `/` and, because `isWelcomeBackSeenThisSession()` is still false, it renders `<WelcomeBackHero />` — that is the screen the user is seeing after the draft.

**Change:**
- In `handleFinish`, also call `markWelcomeBackSeenThisSession()` from `@/lib/welcome-back-store` so the recap is suppressed for the rest of this session (the user literally just created the team — there is nothing to "recap").
- Change the destination from `returnTo` (which defaults to `/`) to `/roster` when the user just finished onboarding a brand new team. This sends them directly to the Court / My Roster.
- Keep the "entry intro" (`BallersIQEntryIntro`) experience: trigger it on first land after onboarding by setting a one-shot flag (e.g. `sessionStorage` `nba_show_entry_intro_once = "1"`) inside `handleFinish`, and have `RequireAuth` read+consume that flag to open `BallersIQEntryIntro` once on the next render — independently of the Welcome Back gate. That gives the desired flow: **Draft → BallersIQ entry intro → Court / My Roster**, with no Welcome Back screen in between.

No other onboarding paths are affected (returning users coming back from picker / leagues still hit the normal `RequireAuth` Welcome Back logic).

## 2) "Add Your Team" dropdown still lists a team that is already in the league

**Where:** `src/pages/LeaguesPage.tsx` → `getAttachableTeamsFor(league)`.

The current filters use the *primary* `league_id` only:
```ts
const alreadyAttached = userTeams.some(
  (t) => t.owner_id === user?.id && t.league_id === league.id,
);
...
const matches = userTeams.filter(
  (t) => t.owner_id === user?.id &&
         (t.league_code ?? "nba") === league.sport &&
         t.league_id !== league.id,
);
```

With the new many-to-many `team_leagues` model, a team that was *joined* into a custom league keeps its original primary `league_id`, but its `league_ids[]` includes the custom league. So the check above never matches and the team keeps appearing in the dropdown.

**Change:**
- Treat a team as participating in a league when **either** its primary `league_id` equals `league.id` **or** its `league_ids` array (already returned by the `teams` edge function) includes `league.id`.
- Helper: `const participatesIn = (t, leagueId) => t.league_id === leagueId || (Array.isArray(t.league_ids) && t.league_ids.includes(leagueId));`
- Use it in both the `alreadyAttached` check and the `matches` filter.
- Keep the existing `(league.myTeamCount ?? 0) > 0` early-out as a belt-and-braces guard, but the fix above is the real one (since `myTeamCount` may lag until `fantasy-leagues` invalidation completes).
- After a successful attach in `handleAttach`, the existing `qc.invalidateQueries(["teams"])` already refetches teams with updated `league_ids`, so the dropdown will hide the team immediately on re-render.

## Out of scope / not changed

- Edge functions (`teams`, `leagues-manage`) — no changes needed; `league_ids` is already returned.
- Database — no migration needed.
- Existing Welcome Back behavior for returning users on subsequent sessions.

## Files to edit

- `src/pages/OnboardingPage.tsx` (handleFinish + entry-intro flag)
- `src/components/auth/RequireAuth.tsx` (consume one-shot entry-intro flag so the intro still plays after we bypass Welcome Back)
- `src/pages/LeaguesPage.tsx` (`getAttachableTeamsFor` participation check)
