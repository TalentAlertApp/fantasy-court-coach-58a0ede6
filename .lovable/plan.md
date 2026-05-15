
## 1. /scoring — empty-to-loaded flow after team creation

When the user lands on `/scoring` with no team in the selected league, the empty-state CTA already navigates to onboarding with `leagueId` + `sport` preselected. After completing onboarding, returning to `/scoring` currently keeps the empty state because the React Query cache for teams isn't invalidated and `selectedTeamId` is still `null`.

Changes:
- In `OnboardingPage.tsx`, after a successful team create:
  - Invalidate `["teams"]` / whichever queryKey `useTeam`/`useFantasyLeagues` uses, so the new team appears.
  - Persist the new team id in `TeamContext` as `selectedTeamId` (call `setSelectedTeamId(newTeamId)` and store in localStorage as the existing context already does), and set `selectedLeagueId` to the league the team was created in.
  - Navigate back to `/scoring` (or wherever the user came from via `location.state.returnTo ?? "/scoring"`).
- In `ScoringPage.tsx`:
  - When `selectedTeamId` becomes non-null and matches a team in the active league, ensure `tab` switches to `"team"` automatically (only on first load after returning from onboarding — guard with a ref so we don't fight the user).
  - Make the empty-state guard also check that the teams query is not still loading (`teamReady`), to avoid a flash of the empty state before teams hydrate.

Result: after creating a team via the empty-state CTA, the user lands back on `/scoring` and immediately sees `LeagueView` (with the team highlighted) and `YourTeamView` populated for that team.

## 2. Daily Court Show — "Played Games Recap" pacing

Today, the Played Games Recap slide overrides `durationMs` to `pages * 3000` (3s per page). When there's only one page, it advances after 3s — much faster than the standard 7.5s "normal" speed used by all other slides. This makes the slide feel rushed.

Changes:
- In `useCourtShowData.ts`, stop hard-coding 3000ms. Instead, attach `pages` (count) to the slide payload and let `CourtShowModal.tsx` compute `SLIDE_MS = pages * BASE_SLIDE_MS` for recap slides. That way recap pages always inherit the user's selected speed (fast/normal/slow).
- In `CourtShowSlide.tsx` recap component, replace the hard-coded `setInterval(..., 3000)` page advance with a `pageMs` prop equal to `BASE_SLIDE_MS`, passed through the slide payload. Pages then turn at the same cadence as the modal advance, so total recap time = `pages * BASE_SLIDE_MS` and each page lasts the same as a Captain Radar slide.
- 1 page → equals one normal slide. 3 pages → equals three normal slides in length.

## 3. Schedule — WNBA GW2 Saturday games + deadlines

DB diagnosis: `schedule_games` already contains the 17 GW2 games (`day=1..5`, including the 4 Saturday May 16 games as `day=4` and the 4 Sunday May 17 games as `day=5`). The sync did import them — but the Schedule page reads its day pills/labels/deadlines from the static `WNBA_DEADLINES` array, which still has only 4 entries for GW2 (Wed/Thu/Sat/Mon, with Sat tagged as `day=3` and Mon as `day=4`). That mismatch is why the Saturday slate is invisible in the UI and why GW2.4 is shown as Sunday May 17 instead of Saturday May 16.

Changes:

a. `src/lib/wnba-deadlines.ts` — replace the 4 GW2 entries with the new 5-day schedule:
```
{ gw: 2, day: 1, date: "2026-05-13", dayName: "Wednesday", deadline_local: "01:06", deadline_utc: "2026-05-13T00:06:00Z" },
{ gw: 2, day: 2, date: "2026-05-14", dayName: "Thursday",  deadline_local: "00:06", deadline_utc: "2026-05-13T23:06:00Z" },
{ gw: 2, day: 3, date: "2026-05-15", dayName: "Friday",    deadline_local: "00:36", deadline_utc: "2026-05-14T23:36:00Z" },
{ gw: 2, day: 4, date: "2026-05-16", dayName: "Saturday",  deadline_local: "00:36", deadline_utc: "2026-05-15T23:36:00Z" },
{ gw: 2, day: 5, date: "2026-05-18", dayName: "Monday",    deadline_local: "00:06", deadline_utc: "2026-05-17T23:06:00Z" },
```
(Times follow the project rule: 30 min before the first Lisbon tip of the slate. Day=5 keeps Monday because Sunday's evening games extend past midnight Lisbon — same convention as other 7-day weeks in the file.)

b. Confirm `wnba-sheet-sync` already preserves `gw`/`day` exactly as provided by the sheet (it does — line 292-293 use `intOrZero(r[0])`/`intOrZero(r[1])`). No edge-function code change needed; the sheet is already authoritative and the next manual `Sync schedule` will keep day numbers in sync. The user's prior sync did succeed; the missing-Saturday symptom was a UI overlay issue, not a data issue.

c. Document in code comment that GW2 has 5 days because the sheet introduced a Friday slate mid-season.

After this change:
- Schedule page shows pills `2.1 (3G) Wed 13`, `2.2 (4G) Thu 14`, `2.3 (2G) Fri 15`, `2.4 (4G) Sat 16`, `2.5 (4G) Mon 18`.
- Daily Court Show for `gw=2 day=4` correctly resolves to the Saturday slate with deadline Sat 00:36 Lisbon.
- Lock evaluations everywhere (`useLeagueDeadlines`, `getCurrentGamedayFrom`) honour the new entries automatically.

## Files touched

- `src/components/onboarding/OnboardingPage.tsx` (or the actual create-team success handler) — invalidate teams, set context, navigate back.
- `src/pages/ScoringPage.tsx` — auto-switch to `team` tab once `selectedTeamId` resolves; guard empty-state with `teamReady`.
- `src/components/court-show/useCourtShowData.ts` — drop hard-coded 3000ms, pass `pages` count.
- `src/components/court-show/CourtShowModal.tsx` — when slide.kind === "recap", compute `SLIDE_MS = pages * BASE_SLIDE_MS`.
- `src/components/court-show/CourtShowSlide.tsx` — accept `pageMs` prop for recap auto-page interval, default to a sane fallback.
- `src/lib/wnba-deadlines.ts` — replace GW2 entries with the new 5-day list.

No DB migration. No edge-function deployment required. After shipping, the existing DB rows for GW2 will line up with the updated static deadlines.
