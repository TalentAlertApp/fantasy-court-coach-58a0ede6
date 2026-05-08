## 1. Played Game Modal (`src/components/GameDetailModal.tsx`)

**Header**
- Remove the click-to-filter behavior on the watermark badges. They go back to passive watermarks (no `<button>`, no glow).
- Make them visually richer: bump from `h-24 w-24` to `h-32 w-32`, keep the rotation/opacity language, push them slightly further into the corners so the score sits centered with breathing room.
- Keep the rest of the header (score, GW/D pill, action buttons) unchanged.

**Modal width**
- Drop `max-w-3xl` back to `max-w-2xl` for played games so the player-name column hugs the FP value.
- Tighten the grid: `minmax(0,1fr)_repeat(9,40px)` → `minmax(0,1fr)_repeat(9,36px)`, with smaller `px-3` → `px-2` row padding.

**Table header — new toggle/filter zone**
- Add the away & home team badges *inside* the table header (left of the FC/BC chips), each ~`h-6 w-6`, no container, dim by default (`opacity-60`), vivid + `ring-2 ring-primary` when active, click toggles `filterTeam` (lifted from header to here).
- Replace the FC/BC text-only pills with the same shape but prefixed by a small colored dot: red dot for FC, blue (primary) dot for BC, so the legend reads at a glance.
- Drop the standalone "ALL" reset button — clicking the active team badge again clears the filter.

**Row density**
- `py-2` → `py-1`, avatar `h-7` → `h-6`, font `text-sm` → `text-[13px]`, keep team logo at `h-4`.
- Stat columns stay `text-sm` for legibility but cell padding shrinks.

## 2. Auto-Pick Confirmation Modal

**Backend** (`supabase/functions/roster-auto-pick/index.ts`)
- Add an optional `dry_run: boolean` field on the request body. When true, run the existing optimizer pipeline but skip the persistence step and return the same `roster` snapshot in the payload.
- Mirror the new flag in `RosterAutoPickBodySchema` (`src/lib/contracts.ts`) as `dry_run: z.boolean().optional()`.

**Client** (`src/lib/api.ts`, `src/pages/RosterPage.tsx`, new `src/components/AutoPickConfirmModal.tsx`)
- `autoPickRoster` accepts `dry_run` in the body.
- Clicking "Auto-pick" now calls the endpoint with `dry_run: true`, stashes the proposed snapshot, and opens `AutoPickConfirmModal`.
- The modal diffs current vs proposed roster (adds, drops, captain change, salary delta, projected FP delta) and renders two columns of player rows + a summary strip. CTA buttons: "Apply changes" (calls `autoPickRoster` again with `dry_run: false`, invalidates `roster-current`, toasts success) and "Cancel".
- Loading + error states use the existing toast pattern.

## 3. CourtShowModal (`src/components/court-show/CourtShowModal.tsx` + slide rendering)

**3a. Speed labels → numeric multipliers**
- Replace the `FAST / NORMAL / SLOW / MANUAL` labels with `1.2 / 1 / 0.8 / ∞` (manual stays as the infinity glyph or a pause icon). Underlying timing values unchanged.
- Use `font-mono tabular-nums` so the digits sit nicely; keep the active-state pill styling.

**3b. Ballers.IQ context block on every game slide**
- Extend the recap and matchups slide payloads (`src/components/court-show/types.ts` and `useCourtShowData.ts`) so each `RecapGame` / `MatchupGame` carries an optional `biq` field of type `BallersIQInsight` (already exists in `src/lib/ballers-iq`).
  - For **played games** (recap slide): generate a `recap`-flavored insight using `recapIntelligence` — headline = top performer's FP line, body = score swing + matchup takeaway.
  - For **scheduled games** (matchups slide): generate a `matchup`-flavored insight using `matchupIntelligence` — covers competitive score, roster relevance, star power.
- In `CourtShowSlide.tsx`, when rendering a recap or matchup card, mount a compact `<BallersIQCard insight={g.biq} compact watermark="emblem" />` underneath the score block. The card already shows the Ballers.IQ brand mark + emblem watermark, so the premium look is preserved automatically.
- Gate the card on `biq` existing so slides without enough data still render cleanly.

## Out of scope
- No changes to the boxscore data layer, roster optimizer math, or schedule logic.
- No new edge functions; only the `dry_run` flag on the existing one.
- SFX cues remain deferred until the user supplies the mp3 files.
