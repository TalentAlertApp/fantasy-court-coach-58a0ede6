## Scope

All changes are in `src/pages/LeaguesPage.tsx`.

---

### 1) Remove the "Create Team" action from every league row/card

The `UserPlus` button (compact list rows) and matching icon button on `LeagueCard` currently call `handleCreateTeam`, which routes to `/?newTeam=1&sport=...&league_id=...`. The `/` route is `MyRoster`, so the user just lands on their current roster — confusing and useless from `/leagues`.

- Remove the "Create Team" button from `LeagueListRow` (the `UserPlus` `<button>` next to "Open league").
- Remove the equivalent secondary `UserPlus` button from `LeagueCard`.
- Remove the now-unused `onCreateTeam` prop from both components and stop passing it from `LeaguesPage`.
- Delete the `handleCreateTeam` function (no longer referenced).
- Keep the "Create League" header CTA — that one is correct.

Note: the legitimate flow to add the user's existing team to a custom league stays via the "Add <team>" attach button (item 3 below).

---

### 2) Rename status `draft` → `OPEN` in the pill

In `StatusPill`, the label currently shows the raw `status` string ("DRAFT" rendered uppercase). User-created leagues sit in `draft` state until games start, which reads as "still being built" — but functionally it means "open to join".

- In `StatusPill`, when `status === "draft"`, render the label `OPEN` (keeping the current amber styling). All other statuses unchanged.
- Apply to both `MY LEAGUES` rows/cards and the `Discover` panel (same component).

---

### 3) "Add Your Team" with team-picker dropdown when multiple same-sport teams exist

Today `getAttachableTeamFor` returns a single candidate (prefers sidebar team, else first same-sport team), and the row renders `+ Add "<that name>"`. When the user owns several same-sport teams (e.g. multiple WNBA teams), they can't choose which one joins.

- Introduce `getAttachableTeamsFor(league)` returning the full list of user-owned teams that match `league.sport` and are not already attached to that league. Reuse current eligibility rules:
  - skip Main leagues
  - league status must be `draft` or `active`
  - exclude teams already in the league (use `team.league_id !== league.id`)
  - exclude teams already counted in `league.myTeamCount` only when the SAME team — multiple owned teams of the same sport may each join independently.
- In `LeagueListRow` and `LeagueCard` replace the single-team `attachableTeam` prop with `attachableTeams: { id; name }[]`.
- Rendering rules per row:
  - `attachableTeams.length === 0` → render nothing (current behavior).
  - `attachableTeams.length === 1` → keep today's single button `+ Add "<TeamName>"` (one click attaches).
  - `attachableTeams.length >= 2` → render a `+ Add Your Team` button that opens a small `DropdownMenu` (shadcn) listing each candidate team name; clicking an item calls `onAttach(teamId)`.
- Update `handleAttach` to accept an explicit `teamId` argument and pass it to the `leagues-manage/attach-team` edge function (replacing the current implicit single-team lookup). Toast shows the chosen team's name.
- Keep both list-row and card variants visually consistent (icon + uppercase label).

No edge-function or schema changes are required — `leagues-manage/attach-team` already takes `{ league_id, team_id }`.

---

## Files touched

- `src/pages/LeaguesPage.tsx` — all three changes.

## Out of scope

- Edge functions, DB migrations, other pages.
- Visual restyle of league rows beyond the affected buttons.
