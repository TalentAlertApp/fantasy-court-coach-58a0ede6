# Plan

## 1) TeamModal → GameDetailModal: missing `youtube_recap_id`

**Root cause:** `TeamModal.tsx` builds `setSelectedGame({...})` in two places (Last games and Upcoming, lines ~244 and ~334) without forwarding `youtube_recap_id`. The underlying query already does `select("*")` from `schedule_games`, so the field is in `g`. `GameDetailModal` then can't render the embedded YouTube recap and falls back to the external link. `PlayerModal` already passes it correctly — that's why it works there.

**Fix:** add `youtube_recap_id: g.youtube_recap_id ?? null` to both `openDetail` payloads in `src/components/TeamModal.tsx`. No other changes.

## 2) Game Played modal — compact side tables + smoother video transition

File: `src/components/game/GameBoxScoreTable.tsx` (compact density only) and `src/components/GameDetailModal.tsx` (transition + height plumbing).

### a) Compact table redesign (only when `density="compact"`)

- **Columns shown:** Player · FP · MP · PS · A · R · B · S. Hide `$` and `V` columns entirely (they remain in default density).
- **Grid:** `grid-cols-[minmax(0,1fr)_repeat(7,28px)]` instead of `repeat(9,...)`. Update the `SORT_COLUMNS` rendering to filter out `salary` and `value` when `compact`.
- **Player row:**
  - Keep avatar + name (name already there — confirmed line 174).
  - Remove the per-row `teamLogo` `<img>` (lines 175–177) when `compact`.
  - Keep the team-badge filter chip in the header (single badge, already correct via `visibleTriBadges`).
- **Fill full vertical height (no inner scroll):**
  - Add a new prop `fillHeight?: boolean` to `GameBoxScoreTable`. When true: outer wrapper becomes `flex flex-col h-full`; body becomes `flex-1 min-h-0 overflow-hidden` and rows get `flex-1` with `min-h-0` so they distribute equally to fill the available height. Avatar size scales with row but stays bounded (`h-5 w-5`). Drop `maxBodyHeightClass` when `fillHeight`.
  - In `GameDetailModal`, pass `fillHeight` to both side tables and remove the inner `overflow-y-auto` wrapper around them.
- **Premium polish:** zebra rows via `even:bg-muted/10`, slightly bolder FP column, subtle right-border on the left panel / left-border on the right panel to frame the video.

### b) Softer video transition

Current behavior: grid `transition-[grid-template-columns] duration-500` snaps the iframe width abruptly (the iframe content rescales hard). Make it feel softer:

- Bump duration to `duration-700` and switch easing to `ease-[cubic-bezier(0.22,1,0.36,1)]` (a gentle "out-expo"-ish curve) on the grid container.
- Add `transition-opacity duration-300` on the iframe wrapper and dip opacity to `0.85` for the first half of the slide (via a small CSS class toggled by `panelsOpen` state transition) to mask the rescale jolt; restore to 1.
- Wrap the iframe in a div with `transform-gpu` so the browser composites the resize cleanly.
- Side-panel inner content keeps its current slide+fade but extended to `duration-700` to match.

### Out of scope
- Default-density boxscore styling.
- Mobile-specific layout (modal already widens at desktop only).
- Any data, salary, or scoring logic.

## Verification
- Open a played WNBA game from a team modal → header shows green "Watch Recap" with embedded video on click; toggle icon appears below score.
- Toggle panels: side tables fill the video's full height with no inner scroll, show only Player/FP/MP/PS/A/R/B/S, no per-row team badges.
- Video resize feels smooth (no snap), and panels glide in/out in sync.

## Technical notes
- `GameBoxScoreTable` props add: `fillHeight?: boolean`. When `density="compact"`, also auto-skip `salary`/`value` SORT_COLUMNS via `SORT_COLUMNS.filter(c => !compact || (c.key !== "salary" && c.key !== "value"))`.
- `GameDetailModal` passes `fillHeight` and removes the wrapping `<div className="h-full overflow-y-auto">` around side `GameBoxScoreTable`s; sets `style={{ height: embedHeight }}` directly on the table's outer div via parent.
