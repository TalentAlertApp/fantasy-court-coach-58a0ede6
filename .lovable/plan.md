
## 1) `/scoring` LEAGUE tab — lock layout, scroll only inside the table

Goal: header, league selector, tab bar, the 4 KPI cards, and the Standings header (title + search + sort) AND the table column header row must all stay fixed on screen. Only the table rows scroll, showing ~10 rows before a vertical scrollbar appears.

### Files
- `src/pages/ScoringPage.tsx`

### Changes

**a) Page shell — make the outer page non-scrolling, give the LEAGUE tab a flex column that owns the remaining viewport height.**

- The root wrapper currently uses `py-5 space-y-5` with natural page scroll. Change to a flex column that fills viewport height under the AppLayout:
  - Root: `flex flex-col h-[calc(100vh-var(--app-header,0px))] min-h-0` (or use existing layout pattern — verify in `AppLayout`). All children above the tab content keep their natural height (`shrink-0`).
  - `<Tabs>` becomes `flex-1 min-h-0 flex flex-col`.
  - Each `<TabsContent>` becomes `flex-1 min-h-0 flex flex-col` so its inner panel can claim leftover height.

**b) LEAGUE TabsContent — make KPI cards fixed, Standings card fill remaining height.**

In `LeagueView`'s returned fragment, wrap into a column:
- KPI grid: keep as-is, mark `shrink-0`.
- Standings card: `flex-1 min-h-0 flex flex-col`.
  - Standings header row (title + search + sort): `shrink-0` (no change to markup).
  - Inner `<div className="overflow-x-auto">` becomes the scroll viewport: `flex-1 min-h-0 overflow-auto`.

**c) Sticky table header inside the scroll viewport.**

- `<table>` gets `border-separate border-spacing-0` (needed so sticky thead doesn't lose its border).
- `<thead>` row: add `sticky top-0 z-10 bg-card` (preserve current bg gradient via an inner wrapper or by setting the th background to `bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80`).
- Each `<th>` gets `bg-inherit` so sticky cells paint correctly.

**d) Show ~10 rows then scroll.**

- The scroll viewport's max height is governed by the flex layout above; on tall screens it grows, on short screens it scrolls. To guarantee "10 rows then scroll", also set a `max-height` cap based on row height:
  - Row height is ~36px (`py-2` + line height). Apply `style={{ maxHeight: 'calc(10 * 2.5rem + 2.25rem)' }}` (10 rows + header) to the scroll viewport. This caps it on tall viewports too, so the experience matches across screen sizes.

**e) No behavioral changes** to sort/search/data fetching.

### Out of scope for this task
- YOUR TEAM and TX PULSE tabs (we only change the LEAGUE tab layout). The shared `<Tabs>` flex container does not affect them visually because their content is shorter; their internal scroll, if any, stays.

---

## 2) Allow "Create New League" from inside onboarding (NameStep → ChooseLeagueStep → /leagues/create)

Current broken flow: in `ChooseLeagueStep`, clicking **Create New League** navigates to `/leagues/create`. Because the user has 0 owned teams (new user) or 1 team (returning user), `RequireAuth` either bounces them to `/welcome` (onboarding gate) or to `/welcome/pick-team` (multi-team gate). They never reach the league builder.

### Strategy

Add a one-shot "in-onboarding new league" escape hatch:
1. `ChooseLeagueStep` persists in-progress onboarding answers (team name + sport + currently selected league ids) and navigates to `/leagues/create` with a `fromOnboarding: true` state flag.
2. `RequireAuth` skips BOTH the onboarding redirect and the multi-team picker redirect when the current path is `/leagues/create` AND `state.fromOnboarding === true` (or simply: always allow `/leagues/create` to render — it's the league builder, never an onboarding loop hazard).
3. `CreateLeaguePage`, when `returnTo === "/welcome"`, navigates back to `/welcome` with state `{ resumeChooseLeague: true, newLeagueId, forceNewTeam: true }` on success (instead of `/leagues`).
4. `OnboardingPage` reads `resumeChooseLeague` + persisted draft, hydrates `pendingName`, `pendingMainSport`, jumps directly to `step="league"`, and pre-selects the newly created league id.

### Files

- `src/lib/onboarding-store.ts` — add a tiny "in-progress draft" helper:
  - `getOnboardingDraft(userId) / setOnboardingDraft(userId, { name, sport, extraLeagueIds }) / clearOnboardingDraft(userId)`.
- `src/components/onboarding/ChooseLeagueStep.tsx`:
  - Accept new optional prop `initial?: { selectedIds?: string[] }` and seed `selectedIds` from it.
  - On **Create New League** click, call `setOnboardingDraft(userId, { name: pendingName, sport: lockedSport, extraLeagueIds: [...selectedIds] })` (pass these via a callback prop `onBeforeNavigateCreateLeague` so the page owns persistence) then `navigate("/leagues/create", { state: { returnTo: "/welcome", fromOnboarding: true } })`.
- `src/pages/OnboardingPage.tsx`:
  - On entry, if `location.state.resumeChooseLeague === true` (and not `forceNewTeam`): rehydrate draft → set `pendingName`, `pendingMainSport`, set `step="league"`, and pass the new league id as a `preselect` prop to `ChooseLeagueStep`. Clear the draft once consumed.
  - When entering `ChooseLeagueStep`, write the draft so it survives the round-trip to `/leagues/create` even if the user refreshes.
  - Add a one-line passthrough to `ChooseLeagueStep`: `<ChooseLeagueStep ... initialSelectedIds={resumedSelectedIds} pendingName={pendingName} sport={pendingMainSport} />`.
- `src/pages/CreateLeaguePage.tsx`:
  - On successful create, if `returnTo === "/welcome"`: `navigate("/welcome", { replace: true, state: { resumeChooseLeague: true, newLeagueId, forceNewTeam: false } })`. Otherwise keep current `navigate(returnTo)`.
- `src/components/auth/RequireAuth.tsx`:
  - Extend the existing skip rule. Treat `/leagues/create` like the picker route: skip the onboarding-gate redirect AND the multi-team picker redirect when `location.pathname === "/leagues/create"`. This lets users in any state reach the league builder.

### Edge cases handled
- Returning user (≥1 team) clicking Create New League: RequireAuth no longer bounces to `/welcome/pick-team`; CreateLeaguePage returns them to `/welcome` which resumes ChooseLeagueStep with the new league pre-selected.
- New user (0 teams) clicking Create New League: same flow, `shouldOnboard` gate skipped on `/leagues/create`.
- User refreshes mid-create: draft survives in localStorage; if they go back manually to `/welcome`, OnboardingPage resumes at ChooseLeagueStep with team name preserved.
- User cancels CreateLeaguePage (clicks Back to Leagues): we keep current behavior (`navigate(returnTo)` → `/welcome`); OnboardingPage with no `resumeChooseLeague` still rehydrates draft and lands on ChooseLeagueStep.

### Out of scope
- No backend / edge-function changes.
- No changes to NameStep, DraftStep, or the league builder steps 1–7 UI.
