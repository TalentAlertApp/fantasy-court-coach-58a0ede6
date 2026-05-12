## 1) Game Played modal — `src/components/GameDetailModal.tsx`

**a) Move the panel-toggle icon below the score, without changing header height**
- Remove the `Columns2` button from the action row (BoxScore / Charts / PbP / NBA).
- Render it inside the center column of the score grid (the `132 - 137` block), absolutely positioned just under the score (`absolute left-1/2 -translate-x-1/2 -bottom-1`) so the header's vertical box stays the same.
- Keep behavior unchanged: only visible while `recapOpen && embedSrc`; toggles `panelsOpen`; same aria/title; same `Columns2` icon.

**b) Fix the right-side (home) table showing the away team badge**
- Root cause: `GameBoxScoreTable` always renders badges in `[away, home]` order from `game.away_team, game.home_team`, regardless of `filterTeam`. So the right panel (filtered to home) still shows away first.
- Fix locally in `GameBoxScoreTable` header: when an external `filterTeam` is provided AND it equals one of the two tricodes, render only that team's badge (so the right panel shows the home badge, the left panel shows the away badge). Hover title/aria already use the tricode — no extra work needed there.
- No change to filter behavior in the standalone (no-recap) usage where `filterTeam` is `null`.

**c) Tighter typography + tighter columns in the side tables; widen modal**
- Add a new optional prop to `GameBoxScoreTable`: `density?: "default" | "compact"` (default `"default"`).
- In `compact` mode:
  - Grid template: `grid-cols-[minmax(0,1fr)_repeat(9,28px)]` (was 36px).
  - Header row: `text-[10px]`, `py-1`, `px-1.5`.
  - Body rows: `text-[11px]`, `py-0.5`, `px-1.5`, avatar `h-5 w-5`, team logo `h-3.5 w-3.5`, name `text-[11px]`.
  - Numeric cells `text-[11px]`.
  - Hide the FC/BC filter chips in compact mode (no room; the filter is unnecessary for a single-team panel).
- Pass `density="compact"` from `GameDetailModal` to both side `GameBoxScoreTable` instances.
- Widen the modal when panels are open: change `max-w-6xl` → `max-w-7xl` in the `DialogContent` className condition.

**Out of scope**
- The standalone (no-recap) boxscore styling stays untouched.
- No changes to data hooks, salary calculations, or filter logic on the standalone view.

## 2) WNBA sheet sync — never read or persist salary

File: `supabase/functions/wnba-sheet-sync/index.ts`, `syncPlayers` mode.

Current behavior already skips the `$` column from the sheet and writes back the existing DB salary. Harden it further so no salary value can ever be sourced from the sheet:

- Remove the `existingSalary` Map and the existing-salary `select`.
- Remove `salary` from the upsert payload entirely (omit the key). Supabase upsert without the column leaves existing rows' `salary` untouched; new rows fall back to the DB column default (`0`), which is then managed by the existing in-app salary recalculation flow.
- Keep the explicit comment in the header parsing block stating column G (`$`) is intentionally ignored, and add an assertion comment that no code path reads `row[6]`.
- No changes to schedule / game-data / advanced-stats modes (they don't touch salary today).

## Verification

- Open a played game → header height matches before; toggle icon now sits under the score.
- Click toggle → side tables slide out; right panel shows the home badge, left panel shows the away badge; hover tooltip on each badge reads "Filter by {TRI}" with the correct tricode.
- Side-table content (names, numbers, columns) fits without horizontal scroll at viewport ≥ 1280px.
- In Commissioner → WNBA Sync → Sync Player Database: existing players' salaries remain unchanged after sync; newly inserted players appear with `salary = 0` until the salary-recalc flow runs.
