## 1. Schedule expanded panel — X no longer overlaps the GW `>` button

In both `src/pages/RosterPage.tsx` (lines ~950–961) and `src/pages/PlayersPage.tsx` (lines ~696–712), the panel renders a close-X at `absolute top-2 right-2` while `SchedulePreviewBody` puts its own `>` (next GW) button at the right edge of its first row. They collide.

Fix: reserve space for the X by adding right padding on the panel wrapper (`pr-10`) so the `>` button can never reach the corner where the X sits. Keep X position as-is. Apply on both pages.

Optionally bump the X to `top-1.5 right-1.5` so it's clearly framed inside the corner, with a tiny bg pill (already styled on PlayersPage). RosterPage's X has no background — give it the same `bg-muted/60` chip for visibility.

## 2. `/schedule` list view — inline rows + shared `@` baseline

File: `src/components/ScheduleList.tsx`, the list-view rendering used today (lines ~1296–1381 — the `grid grid-cols-[1fr_auto_1fr]` branch).

Current bug: the away/home clusters wrap team-name and score in a vertical `<div>` (lines 1331–1338 and 1372–1379). That stacks "LAS VEGAS ACES" above "101" and also makes card heights inconsistent, which throws off the vertical position of the centered `@`.

Changes inside the center "Teams + status" grid:

- Away cluster (one flex row, items-center, gap-2):
  - `NAME` (`text-sm`, `leading-none`) → optional `SCORE` (`text-2xl`, `leading-none`, `tabular-nums`, bold when winner) → `LOGO` (12×12).
  - Justified to the right, with `whitespace-nowrap` on name.
- Home cluster mirrors: `LOGO` → optional `SCORE` → `NAME`, justified left.
- Remove the inner wrapper `<div>` that was stacking name + score.

Center status column (the `@` block):

- Keep `flex flex-col items-center justify-center` and use `leading-none` plus consistent `gap-0.5` between the three lines (`@`, status, time).
- Render the time row even for SCHEDULED games (already does) and reserve a fixed min-height (e.g. `min-h-[60px]`) so every card — final, live, scheduled — has the same vertical footprint.
- Set the parent row to `items-center` so the `@` block is vertically centered against the now single-row team clusters. With both clusters constrained to one line and the center column having a fixed height, the `@` glyph lands at the same y-coordinate across every card.

Apply the same single-row layout to the older list branch at lines ~1086–1133 for parity (so any code path lands on the same look).

No business-logic changes; presentation only.

## Files touched

- `src/components/ScheduleList.tsx` — restructure the two list-view team clusters and lock the center column height.
- `src/pages/RosterPage.tsx` — `pr-10` on the schedule overlay; tidy X chip.
- `src/pages/PlayersPage.tsx` — `pr-10` on the schedule overlay.
