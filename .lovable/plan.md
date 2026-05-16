## Scope

Five fixes across the web app. No new business logic — just corrections, layout parity, and routing affordances.

---

### 1) Deadlines — recompute to "first tipoff − 30 min" (Lisbon)

**Problem**: e.g. WNBA GW 2.4 has `deadline_local: 00:36` on 2026-05-16, but the first tipoff that gameday is 00:30 → deadline must be **00:00 Sat (Lisbon)**. Same drift suspected across other gamedays and across the NBA table.

**Fix**:
- Add a one-off Node/TS audit script (`scripts/audit-deadlines.ts`) that, for each league:
  - Reads `schedule_games` per `(league_id, gw, day)` from Supabase.
  - Computes `firstTipoffUtc = MIN(tipoff_utc)` per gameday.
  - Computes `expectedDeadlineUtc = firstTipoffUtc − 30 min`.
  - Diffs against `src/lib/deadlines.ts` (NBA) and `src/lib/wnba-deadlines.ts` (WNBA), printing every mismatch.
- Regenerate both files from the audit output:
  - `deadline_utc` = `firstTipoff − 30 min` (UTC ISO).
  - WNBA: also recompute `deadline_local` (Lisbon `HH:mm`) and `date` (Lisbon calendar date of the lock, which can differ from the gameday's date — Sat 00:00 lock for a Sat tipoff lives on Sat, but Sat 00:00 lock for a 00:30 Sat tipoff lives on Sat too; the script handles both).
- Keep file shape, comments, and ordering identical so reviewer can diff cleanly.
- No DB/edge-function changes — both files are the runtime source of truth (`useLeagueDeadlines`).

---

### 2) Court Show — "High-Competitive Matchups" slide parity

In `src/components/court-show/CourtShowSlide.tsx`:

- **2a. Watermark**: stop using `getTeamLogo(home_team)` for the `matchups` slide. Instead, fall through to the league watermark (NBA or WNBA logo, resolved from `useLeague()` passed via `CourtShowModal`). Apply the same change to the **`recap`** slide (item 3 below).
  - Extend `CourtShowSlide` props with `leagueCode: "nba" | "wnba"`; render `/src/assets/nba-logo.svg` or `/src/assets/wnba-logo.png` at the same `-top-16 -right-16 h-[420px]` blurred position.
- **2b. Card layout parity with "Next Up"**: replace the current 3-column `[1fr_auto_1fr]` block (lines ~1272–1340) with the same compact card used by the `next_games` slide:
  - `px-4 py-3` card height
  - Centered tricodes (`text-xl`, `tracking-[0.18em]`), no team logos
  - `@` separator
  - Bottom-right venue + tipoff (`absolute bottom-2 right-3`, `getVenue(home_team)`)
  - Keep the competitive label chip (e.g. SLATE HAMMER) and the existing `onGameClick` / `onTeamClick` handlers
  - Drop the "roster relevant" sub-row and star-player block — Matchups slide becomes a clean grid like Next Up.

---

### 3) Court Show — "Played Games Recap" slide watermark

Same change as 2a for the `recap` slide: remove `getTeamLogo(winner)` watermark; render the league logo (NBA/WNBA) instead. Implemented in the same `CourtShowSlide` watermark block.

---

### 4) Scoring page — wrong empty state when active team isn't in selected league

`src/pages/ScoringPage.tsx` lines 222–235 currently show "Create a team in WNBA" and route to `/welcome`, which lands on `/roster` for the user's already-selected team.

**Fix** (frontend only, uses existing edge functions):
- When `myTeams.length === 0` (no team for the active user in the currently-selected fantasy league) **but** the user has an active team in the same sport (`selectedTeam && selectedTeam.league_code === selectedLeague.sport`):
  - Replace the empty state with: "**Add `<NBA MAIN TEAM>` to `<WNBA IS MINE>`**" + secondary "Create a new team" link.
  - Primary CTA calls a new helper `addExistingTeamToLeague(teamId, leagueId)` that invokes the existing `leagues-join` edge function (or the `leagues-manage` action that attaches a team) with `{ league_id, team_id }`. If the function only supports join-by-code, add a thin server action — but first check `leagues-manage/index.ts` to reuse the existing path.
  - On success: invalidate `["league-standings"]`, `["scoring-history"]`, `["league-teams"]` and stay on `/scoring`.
- When no same-sport team exists, keep today's "Create a team in WNBA/NBA" CTA but route to the onboarding new-team flow (`/?newTeam=1&sport=…&league_id=…`) — same as `LeaguesPage.handleCreateTeam`, NOT `/welcome`.

---

### 5) Leagues page — allow attaching the active sidebar team to eligible "My Leagues"

In `src/pages/LeaguesPage.tsx` (list + grid rows, `LeagueCard` and `LeagueListRow`):
- For each league in the **My Leagues** tab where:
  - `league.sport === selectedTeam.league_code`, and
  - the selected team is not already a member (`!teamsInLeague.includes(selectedTeam.id)`), and
  - the league still accepts teams (draft/active and below cap),
- Show a new compact pill button "**Add `<NBA MAIN TEAM>`**" next to the existing "Create team" icon. Reuse the same `addExistingTeamToLeague` helper from item 4.
- Today's "Create team" icon stays for users who want a brand-new team in that league.

---

### Technical notes

- **No DB schema changes** expected; verify the existing `leagues-join` / `leagues-manage` edge function supports "attach an already-owned team to a league". If not, extend that function (not a new one) with an `attach_team` action; RLS already restricts to team owner.
- **Files touched**:
  - `src/lib/deadlines.ts`, `src/lib/wnba-deadlines.ts` (regenerated)
  - `scripts/audit-deadlines.ts` (new, dev-only)
  - `src/components/court-show/CourtShowSlide.tsx`, `src/components/court-show/CourtShowModal.tsx` (pass `leagueCode`)
  - `src/pages/ScoringPage.tsx`
  - `src/pages/LeaguesPage.tsx`
  - Possibly `supabase/functions/leagues-manage/index.ts` (only if no attach path exists)
- **Out of scope**: Health Watch, Next Up styling, mobile app, sheet sync, deadline editor UI.
