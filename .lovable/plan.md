# Game Recaps modal — rework

Single-file rewrite of `src/components/schedule/GameRecapsModal.tsx`. No other files need to change; existing components (`GameBoxScoreTable`, `GameBallersIQSidePanel`, `getVenue`) provide everything required. The modal becomes a one-screen, no-scroll layout.

## 1. Selector bar (top, below modal header)

Two inline rows on a single bar, no stacked labels:

```text
[Gameday · Wed, May 27]  [‹] [GW ▾] [Day ▾] [›]      ● N recaps
[Game]                   [Away @ Home  ▾  (2/3 width)]
```

- Labels sit inline to the left of their controls (not above).
- The Game dropdown trigger width is reduced to ~`max-w-[66%]` / `w-2/3` of the row (was full-width).
- Drop the `Ballers.IQ` toggle button entirely (item #5).
- Keep prev/next chevrons, recap-count pill.

## 2. Remove header & player table

- Delete the `GameMatchupHeader` block (venue watermark + GW/D/tipoff/venue pills + away-score-home banner + `GameActionLinks`).
- Delete the full-width `GameBoxScoreTable` block currently rendered below the header.

## 3. New body (selected-game state) — three columns

A single CSS grid filling the modal body with no inner vertical scroll:

```text
┌─ AWAY BOX (compact) ─┬─ VIDEO (16:9, scaled) ─┬─ HOME BOX (compact) ─┐
│  GameBoxScoreTable   │   <iframe recap>       │  GameBoxScoreTable   │
│  filterTeam=away     │                        │  filterTeam=home     │
│  density="compact"   │                        │  density="compact"   │
│  fillHeight          │                        │  fillHeight          │
└──────────────────────┴────────────────────────┴──────────────────────┘
┌──── Ballers.IQ horizontal rail (same total width, equal cards) ─────┐
│  [MVP]   [Top Performers]   [Value Ace]   [Game Chips]              │
└──────────────────────────────────────────────────────────────────────┘
```

- Grid columns: `grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)]` so the video stays the visual centerpiece while leaving real estate for the two side tables.
- Video container keeps `aspect-video` but its width is now ~60% of the modal (smaller than before), and table column heights are matched to it via `fillHeight` on `GameBoxScoreTable` (already supported).
- Each box-score column passes the existing `filterTeam` + `setFilterTeam={() => {}}` + `density="compact"` + `fillHeight` props — mirrors the pattern already used in `GameDetailModal` (lines 356, 383).
- The whole body uses `overflow-hidden` and `h-full`; no scrollbars inside the modal.

## 4. Venue background (item #6)

When a game is selected:
- Resolve via `getVenue(selectedGame.home_team)` from `@/lib/nba-venues` (already imported in `GameDetailModal`).
- Render the venue image as an absolutely-positioned layer behind the body content (below modal header), with a dark gradient + slight blur overlay so foreground tables/video remain legible. Falls back to the current amber-radial gradient if no venue image.
- When no game is selected (empty state) the background stays as the Ballers.IQ amber gradient.

## 5. Ballers.IQ horizontal rail (item #7)

Replace the right-side `GameBallersIQSidePanel` rail with a horizontal strip directly under the 3-column row. Split the existing intel into 3–4 equal cards laid out in a `grid grid-cols-2 lg:grid-cols-4 gap-3`:

- **MVP** — top FP player (name, FP, team logo).
- **Top Performers** — top-5 chip list.
- **Value Ace** — best FP/$.
- **Game Pulse** — the existing chips (HIGH FP GAME / CLOSE GAME / etc.).

Implementation: extract this from `GameBallersIQSidePanel.tsx` logic inline in the modal file (memo using `useGameBoxscoreQuery(selectedGame.game_id)`), no new shared file required. Total rail width = away-table + video + home-table (i.e., it spans `col-span-3` of the grid above). Keep amber border treatment; remove the `BALLERS.IQ` brand label (item #5).

## 6. Empty state

Keep the placeholder card but scale it to the same shrunken video footprint so the layout sits in one screen. Skip the Ballers.IQ rail when no game is selected.

## Files touched

- `src/components/schedule/GameRecapsModal.tsx` — rewritten body and selector bar only. All other files (`GameMatchupHeader`, `GameBallersIQSidePanel`, `GameBoxScoreTable`, `GameDetailModal`) are untouched.
