## 1) Immediate refetch + UI update after attaching a team

**Where:** `src/pages/LeaguesPage.tsx` → `handleAttach`.

**Problem:** `qc.invalidateQueries({queryKey:["teams"]})` only marks the query stale and schedules a background refetch. The dropdown re-renders from the old cache first, and on some screens the user perceives the just-attached team still listed under "Add Your Team". The `fantasy-leagues` count is similarly stale.

**Fix:**
- Replace both `invalidateQueries` calls with awaited `refetchQueries({queryKey:["teams"], type:"active"})` and `refetchQueries({queryKey:["fantasy-leagues"], type:"active"})` so the new `team_leagues` row is in cache before we drop `attachingLeagueId`.
- Additionally do an optimistic cache update on the `["teams"]` query: append `league.id` to the target team's `league_ids` immediately on click, so the dropdown filter (`getAttachableTeamsFor` → `participatesIn`) hides the team in the same frame even before the network round-trip.
- On error, roll the optimistic mutation back.

No backend changes — `leagues-manage/attach-team` already upserts the `team_leagues` row and `teams` edge function already returns `league_ids`.

## 2) Standings table fills available vertical space

**Where:** `src/pages/ScoringPage.tsx` (LEAGUE tab) and the Standings panel container.

**Fix:**
- Make the LEAGUE tab a column flex container with `min-h-0` and `flex-1`, anchored to the available viewport height (`h-[calc(100vh-<headerOffset>)]` or by wrapping in an `h-full` ancestor that already covers viewport).
- Wrap the existing `<StandingsTable>` in a flex child with `flex-1 min-h-0 overflow-auto` so the inner scroll area grows down to the bottom of the screen instead of the current fixed/intrinsic height.
- KPI tiles, league selector, sub-tabs, and the Standings header bar stay as fixed-height rows above; only the table region absorbs the remaining space.

Exact files to touch will be confirmed when implementing (likely `ScoringPage.tsx` + `src/components/standings/StandingsPanel.tsx` wrappers; no logic changes, only layout classes).

## 3) Remove league chips from the sidebar team pill

**Where:** `src/components/TeamSwitcher.tsx`.

**Problem:** Earlier we added `<TeamLeagueChips>` inside each `<SelectItem>`. shadcn's `<SelectValue>` mirrors the selected item's children into the trigger, so the chip row also renders inside the small sidebar pill, breaking its layout (screenshot 2).

**Fix:**
- Render the trigger content manually: replace `<SelectValue placeholder="Select team" />` with an explicit node that shows only the `LeagueLogoBadge` + truncated team name for the currently-selected team (no chips).
- Keep `<TeamLeagueChips>` inside `<SelectItem>` so chips still appear in the open dropdown rows (that part is useful and stays per the previous request). If chips inside dropdown rows still feel noisy in the narrow popup, we can also drop them from the items — flag for confirmation when implementing.

No changes to `TeamLeagueChips.tsx` itself; `TeamPickerPage` continues to use it.

## 4) Blank preview window — verification

**Symptom:** The preview shows a blank gray viewport at `/welcome` (screenshot 3).

**Likely cause:** `OnboardingPage` renders a transparent placeholder `<div className="h-screen w-full bg-background" aria-hidden />` while `!ready || (!shouldOnboard && !preselectedLeagueId && !forceNewTeam && !resumeChooseLeague)`. For a returning user hitting `/welcome` directly with no nav state, this branch is hit while a `useEffect` schedules `navigate("/welcome/pick-team")`. If `ready` never flips true (e.g., `useFirstRunGate` stalls because `useTeam().isReady` stays false), the page stays blank forever — exactly what the screenshot shows.

**Plan:**
- Reproduce by visiting `/welcome` with no state on a returning user; check console + network for failed `teams` / `fantasy-leagues` calls.
- If `ready` is stuck: replace the silent blank placeholder in `OnboardingPage` with the same neutral spinner used in `RequireAuth`, AND have the redirect effect fire regardless of `ready` when the user has already-loaded teams (use `teams.length >= 1` from `useTeam()` as a fallback trigger to push to `/welcome/pick-team`).
- If the root cause is a failed teams fetch (HTTP 5xx), fix the cause and surface a retry instead of a permanent blank.
- Verify after fix by hard-refreshing `/welcome` and `/` and confirming the picker (or destination page) renders.

### Implementation order
1. Sidebar pill fix (smallest, immediate visual relief).
2. Optimistic + awaited refetch on attach.
3. Standings table flex layout.
4. Blank-screen investigation + targeted fix.

No DB migrations, no edge function changes.
