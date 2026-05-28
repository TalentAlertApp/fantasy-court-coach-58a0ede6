## Goal
Tighten the visual balance of the Game Recaps modal so the video + box scores feel like the centerpiece, the selector bar reads as one connected control, the venue lives behind the action, and a new past/next games rail anchors the bottom.

## Changes (all in `src/components/schedule/GameRecapsModal.tsx` + 1 new component)

### a) Wider game selector
- Bump game `Select` wrapper from `w-[clamp(220px,28%,380px)]` to `w-[clamp(320px,42%,560px)]` so full matchup labels breathe.

### b) Bigger video, matching table heights, vertically centered body
- Change grid ratios from `1fr_1.6fr_1fr` → `0.85fr_2fr_0.85fr` (video gets more width, tables get narrower).
- Wrap the 3-column grid in a flex column with `justify-center` so it sits vertically centered in the available area (instead of stretching to fill).
- Constrain the row to `max-h-[min(100%,calc((100vw*0.42)*9/16+8px))]` so the video keeps 16:9 and both tables match the video's exact pixel height (use `h-full` on the table wrappers; video already aspect-locked).
- Reserve vertical room for the new rail (item c) by capping the central row at roughly `60%` of the body height via `flex-1 min-h-0` on a wrapper that also contains the rail with a fixed height.

### c) Past 2 + Next 2 games rail (always visible)
- New component `src/components/schedule/GameTeamsFormRail.tsx`:
  - Props: `awayTeam`, `homeTeam`, `referenceDate` (selected gameday's date or today if no selection), `awayName`, `homeName`.
  - Internally calls a small hook `useTeamRecentUpcoming(team, refDate)` (new) that pulls from `schedule_games` filtered by `league_id` + `(home_team = team OR away_team = team)`, splits into played (status FINAL, tipoff_utc ≤ ref) → last 2, and unplayed/scheduled (tipoff_utc > ref) → next 2, ordered chronologically.
  - Renders one card row: `[ 4 circles for away (oldest → newest) ]   |   <one-sentence game blurb>   |   [ 4 circles for home (oldest → newest) ]`.
  - Each circle: same look as `PlayerRow` slots — `w-6 h-6 rounded-full bg-background/60 border border-amber-400/20`, opponent tricode logo centered, fallback to tricode text. Played circles tinted W/L green/red ring; upcoming circles neutral; tooltip with date + opponent + score (if played).
  - Blurb: simple deterministic sentence such as `"${awayName} visit ${homeName} — final ${away_pts}-${home_pts}"` when game selected, otherwise `"${awayName} vs ${homeName} · last & next matchups"`.
  - Uses `|` glyph separators between sections.
- Always render this rail (even with no game selected), using the gameday's date as the reference and the two teams of the *first* played matchup (or hide the team-specific halves and show only "Pick a game to see form" if there is no selected game and no away/home context). Default: render only when a game is selected, AND also render a generic version (no teams) under the empty state so the layout doesn't jump — final decision: always-mounted container that swaps content based on `selectedGame`.

### d) Lighter venue background
- Reduce `img` opacity from `opacity-25` → `opacity-55`.
- Replace heavy overlay `from-black/75 via-black/60 to-black/85` with `from-black/45 via-black/30 to-black/60` and drop `backdrop-blur-[2px]` so the venue reads through.
- Keep a subtle vignette via `radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.45))` for legibility.

### e) Selector bar typography + size normalization
- Standardize all chip-like elements (Gameday label, Game label, BallersIQ button, recap-count chip) to the same vertical rhythm:
  - Height `h-9`, padding `px-3`, font `text-[11px] font-heading uppercase tracking-[0.18em]`.
  - Labels become small caps chips inside the same `rounded-lg border border-amber-400/15 bg-background/40` shell as the dropdowns.
  - Group them visually: `[ Gameday · Thu, May 28 ] [ ‹ GW Day › ] [ Game ] [ <select> ]  …  [ Ballers.IQ ] [ N Recaps ]` — all share equal height, consistent border treatment, identical font.
- `BallersIQButton` and the recap-count pill: rebuild to share the same `h-9 px-3 text-[11px] font-heading uppercase tracking-[0.18em]` baseline so they stop looking like a different family.

### f) Smaller empty-state card with soft edges
- Reduce empty-state container from `max-w-5xl aspect-video` → `max-w-3xl aspect-[16/10]`.
- Round corners further: `rounded-[28px]` and add `ring-1 ring-amber-400/15 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)]`.
- Add an inner soft inset using a mask: `mask-image: radial-gradient(ellipse at center, black 70%, transparent 100%)` on the court image so edges fade rather than stop hard.

### g) Light-theme empty-state texture
- In `src/index.css` add a `.recap-empty-court-light` utility (only used when `:not(.dark)`) with a basketball-court inspired warm gradient: layered `linear-gradient` (parquet wood tones `#d9a86c → #b97a3f`) plus a faint repeating-linear-gradient for plank lines and a centered radial amber glow.
- In the empty state, conditionally apply: `dark:bg-[url(court-bg)] dark:bg-cover bg-none recap-empty-court-light` so dark theme keeps the current court image and light theme gets the warm parquet texture.
- Keep the same darkening overlay strength but switch its tint to `bg-black/35` in light theme so the parquet remains visible.

## New / touched files
- `src/components/schedule/GameRecapsModal.tsx` — layout, selector normalization, venue overlay, empty-state sizing, mounts new rail.
- `src/components/schedule/GameTeamsFormRail.tsx` (new) — past/next rail.
- `src/hooks/useTeamRecentUpcoming.ts` (new) — Supabase query for last 2 played + next 2 scheduled per team relative to a date.
- `src/index.css` — `.recap-empty-court-light` utility for light theme parquet.

## Out of scope
- No backend / Supabase schema changes.
- No changes to `GameBoxScoreTable` or `GameBallersIQSidePanel` internals.
- No changes to the Ballers.IQ toggle behavior (still swaps tables ↔ BIQ panels in place).
