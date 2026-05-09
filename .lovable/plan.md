## 1. SFX cues — wire the three audio files

- Copy the three uploads into `src/assets/audio/`:
  - `swoosh.wav` → captain set
  - `lineup.wav` → lineup saved (whistle)
  - `buzzer.wav` → deadline alert
- Create `src/hooks/useSfx.ts` exporting a small singleton-cache helper:
  - Imports the three assets via ES6 (so Vite hashes/bundles them).
  - Exposes `play(kind: "swoosh" | "lineup" | "buzzer")`.
  - Lazily constructs `HTMLAudioElement`s, sets `volume = 0.55`, clones on each call so rapid retriggers overlap cleanly.
  - Honors a `localStorage` mute key `sfx.muted` (default off) so we can later add a UI toggle without refactor.
- Wire from `src/pages/RosterPage.tsx`:
  - `swoosh` inside the captain handler at line ~441 (`setCaptainId(playerId)` block).
  - `lineup` inside `saveMutation`'s `onSuccess`.
  - `buzzer` inside `useCountdown` — fire once when the remaining time crosses **5:00**, **1:00**, and at **0** (LOCKED). Track "already fired" thresholds in a `useRef<Set<number>>` keyed by deadline.

## 2. Court Show modal

### a) Replace inline Ballers.IQ blurbs with a dedicated slide
- Remove the `BallersIQInline` blocks rendered inside each game card in `CourtShowSlide.tsx` (recap + matchup sections).
- Extend `SlideKind` in `src/components/court-show/types.ts` with `"ballersiq"` and add a `BallersIQSlidePayload`:
  ```ts
  { kind: "ballersiq"; data: {
      mode: "recap" | "matchup";
      gw: number; day: number;
      headline: string;             // e.g. "GAMENIGHT INTELLIGENCE"
      bullets: { title: string; body: string; icon?: "flame"|"target"|"trend"|"shield" }[];
      topPerformer?: TopPerformer | null;
      keyMatchup?: MatchupGame | null;
  } }
  ```
- In `useCourtShowData.ts`, after the recap/matchups slides are built, push a single `ballersiq` slide:
  - Recap day → 3–4 bullets distilled from existing `recapBlurb` outputs (top performer line, blowout/coin-flip count, biggest value pop reusing `value` slide data).
  - Matchup day → 3–4 bullets from `matchupBlurb` (most competitive game, most roster-relevant, star power leader).
  - Insertion order: **after** the `recap`/`matchups` slide, **before** the `captain` slide.
- Add a render branch in `CourtShowSlide.tsx` for `kind === "ballersiq"` that mirrors the typography, header chrome, and `motion` cadence of the other slides:
  - Title row uses `<BallersIQBrand variant="wordmark" forceTheme="dark" transparent />`, no surrounding container.
  - One large `<BallersIQBrand variant="emblem" forceTheme="dark" transparent />` absolutely positioned at low opacity as the watermark (analogous to existing slide watermarks).
  - Bullets in a 2-column grid, each card ghost-bordered, premium dark styling consistent with the rest of the show.

### b) Fix “can’t advance past slide 1 in fullscreen”
The keyboard listener is bound to `window`, but Radix `<Dialog>` traps focus and pointer events to the dialog overlay; in fullscreen the overlay sits behind `document.fullscreenElement`, so footer button clicks can land on the wrong target and key events can be swallowed by the dialog root.
- Move the `keydown` listener from `window` to `containerRef.current` (the fullscreened element) and refocus it (`tabIndex={-1}` + `el.focus()`) whenever fullscreen toggles.
- Also bump the footer/topbar `z-index` to `z-[60]` and add `pointer-events-auto` so the Prev/Next buttons remain clickable inside `:fullscreen`.
- Add `:fullscreen { background: black; }` style on the container so the layout is preserved.

## 3. Team of the Week — correct positions

Goal: match the layout shown in the screenshot (3 FC across the top half, 2 BC on the bottom half, evenly spaced).
- In `TeamOfTheWeekModal.tsx#getFormation`, after the FC/BC split, sort each group by `fp_avg` desc so the highest scorers anchor center / outside positions deterministically (current order is whatever Postgres returned).
- Use `getRowPositions(fcs.length, "32%")` and `getRowPositions(bcs.length, "70%")` to push BC further down and FC slightly higher (the current 28/72 leaves the FC photos clipped against the top edge once the cinematic photo size is applied).
- Cap the rendered group sizes at the standard 3 FC + 2 BC; if upstream returns more, slice after sort.
- Keep the existing staggered Framer reveal — only the position math changes.

## 4. Auto-Pick proposal modal — wire player rows to PlayerModal

- In `src/components/AutoPickConfirmModal.tsx`:
  - Accept a new prop `onPlayerClick: (id: number) => void`.
  - Make `PlayerRow` clickable (the entire row + the avatar) calling `onPlayerClick(p.id)` with `cursor-pointer hover:bg-accent/30 rounded-md` styling.
- In `RosterPage.tsx`, where `<AutoPickConfirmModal>` is rendered, pass `onPlayerClick={(id) => setOpenPlayerId(id)}` so the existing `PlayerModal` opens on top of the proposal modal (Radix dialogs stack natively).

## 5. /schedule expanded panel — reuse the premium boxscore table

- Export the existing `GameBoxScoreTable` from `GameDetailModal.tsx` (rename the local function and add `export`), or extract it into `src/components/game/GameBoxScoreTable.tsx` and re-import it in `GameDetailModal.tsx`. Extracting is cleaner — do that.
- Replace the legacy `GameBoxScore` JSX inside `src/components/ScheduleList.tsx` with a thin wrapper that:
  - Lays out a 2-column grid `[1fr_640px]` so the right-side `<RecapCard>` is preserved.
  - Renders the new shared `<GameBoxScoreTable game={...} />` on the left.
  - Keeps the wrapper at `max-h-[360px]` with `overflow-y-auto` so the existing expanded-panel vertical height + scroll behavior is unchanged.
- Drop the now-unused `SORT_COLUMNS` / `GameBoxScore` definitions from `ScheduleList.tsx`.

## 6. Scheduled Game modal — merge "Last 5" and "League Rankings" + wire L5 rows

In `GameDetailModal.tsx#ScheduledInsights`:
- Remove the `<Tabs>` wrapper. Render Last 5 first, then League Rankings stacked underneath, separated by a thin divider with a small heading per section (`Form` / `League rankings`) using the existing `text-[9px] font-heading uppercase tracking-[0.22em]` style.
- Convert each W/L pill into a button (keep visual as-is) that, when clicked, opens a nested `<GameDetailModal>` for that historical game. The `Last5Detail` already carries `game_id`, `homeTeam`, `awayTeam`, `homePts`, `awayPts`, and the action URLs — map straight into a `GameDetailGame` and set local state `historyGame`. Render `<GameDetailModal game={historyGame} ... />` at the end of the component (Radix supports modal-on-modal stacking).
- No data-layer changes required.

## Out of scope
- No new edge functions, no scoring/optimizer logic changes.
- No SFX UI mute toggle yet (hook supports it, surface later if asked).
- No restyle of the recap right-pane in the schedule expanded panel beyond keeping it intact.

## Files touched
- `src/assets/audio/swoosh.wav|lineup.wav|buzzer.wav` (new)
- `src/hooks/useSfx.ts` (new)
- `src/pages/RosterPage.tsx`
- `src/components/court-show/types.ts`
- `src/components/court-show/useCourtShowData.ts`
- `src/components/court-show/CourtShowSlide.tsx`
- `src/components/court-show/CourtShowModal.tsx`
- `src/components/TeamOfTheWeekModal.tsx`
- `src/components/AutoPickConfirmModal.tsx`
- `src/components/game/GameBoxScoreTable.tsx` (new, extracted)
- `src/components/GameDetailModal.tsx`
- `src/components/ScheduleList.tsx`
