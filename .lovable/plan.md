## Goal

Eliminate the Game dropdown in the Game Recaps modal. Instead, render all available games for the selected GW + Day directly inside the court placeholder (the empty state area). Clicking a row loads that recap into the existing video + box scores + form rail layout (which stays unchanged).

## Changes — `src/components/schedule/GameRecapsModal.tsx`

### 1. Top selector bar (single row, re-centered)

New grid: `[auto_1fr_auto]` where:

- **Left**: `GAMEDAY · <Date>` label (unchanged styling, stays where the design uses left slot).
- **Center (justify-self-center)**: a single inline cluster containing, in order:
  1. `<` prev gameday chevron
  2. GW select
  3. Day select
  4. Calendar icon popover (unchanged behavior)
  5. `>` next gameday chevron
  6. The green `N RECAPS` pill — moved here, inline immediately after the calendar
- **Right (justify-self-end)**: BallersIQ button only.

Remove the entire `Game` label chip and the `GameRowPopover` from the top bar.

### 2. Court placeholder becomes a game picker

When `selectedGame` is null:

- Keep the existing `EmptyState` court visual (court background, amber glow, title).
- Inside it, render the list of `playedGames` (and "no recaps" message when empty) using the **exact same row layout** that the dropdown currently uses — same `GAME_ROW_GRID`, same `TeamWatermark` watermark logos with surge-on-hover, same winner bolding, same `@` alignment.
- Each row is a clickable button. Clicking sets `selectedGameId` → existing flow loads video + box scores.
- Cap visible rows to fit the court area, scroll inside if more.
- Title copy changes to "Pick a game to tip off" with a short subtitle: "N recaps available for <Date>".

When `selectedGame` is set:

- The whole 3-column layout (away box / video / home box) renders exactly as today — unchanged.
- The selected game's matchup (score + teams + @, same row layout) is rendered as a small centered header **above** the 3-column grid, right under the top bar, so the user always sees what they picked. A "Change game" affordance reopens the picker (sets `selectedGameId` to null).

### 3. Component extraction

Extract the row markup currently inside `GameRowPopover` into a small `GameRow` component used by both the inline list and the selected-game header. Keep `GAME_ROW_GRID` and `TeamWatermark` exactly as they are.

Delete `GameRowPopover` and its `gameOpen` / `setGameOpen` state.

## Out of scope (unchanged)

- Video iframe, both `GameBoxScoreTable` panels, `GameTeamsFormRail`, `GameActionLinks`, `GameDetailModal`, BallersIQ side panel logic, calendar disabled-date logic, deadlines/week-games hooks.
- The Advanced › Play Search › By Game selector.

## Technical notes

- Reuse `GAME_ROW_GRID` and `TeamWatermark` verbatim so the inline list, the selected header, and the previous dropdown rows stay visually identical.
- The inline list lives inside the existing `EmptyState` container; swap its description paragraph for the scrollable rows. Keep court background + amber glow.
- The selected-game mini header uses the same row but with `aria-current` styling (subtle amber tint) and a small "change" ghost button on the right that clears `selectedGameId`.
- No changes to data fetching or props.
