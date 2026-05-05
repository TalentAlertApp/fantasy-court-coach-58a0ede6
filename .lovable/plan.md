## Scope

Eight targeted fixes. No new pages, no new buttons beyond what the prompt explicitly allows.

---

### 1) Market Watch — real "Schedule Streams"

`src/components/AICoachModal.tsx` (Transfers tab):
- Replace the hard-coded `todayTeams: string[] = []` with the team set from `useUpcomingByTeam()` (already used on Roster). Compute today's tricodes (`Europe/Lisbon` date) and pass as `todayTeams`.
- Streams lane will now surface affordable players whose team has a game today.

### 2) Market Watch row → focus Explain tab

Already partially wired (`onPickPlayer` switches to Explain). Improvements:
- Preserve current `selectedExplainPlayer` only if the row matches it; otherwise replace.
- Auto-run explain on selection (see #6) — the row click becomes "select + run".
- Keep recent-explained list updated.

### 3) /my-roster header & list cleanup

`src/pages/RosterPage.tsx`:

a) **Header** — remove the `<BallersIQLineupStrip />` block (lines 483–493). Keep the Ballers.IQ wordmark button and Wishlist button untouched.

b) **Restore "LINEUP ADVISOR" toolbar button** (court view) — add a button next to Schedule/Chips/Optimize labelled `LINEUP ADVISOR` (icon: BallersIQ emblem). Clicking toggles an inline overlay rendering `<LineupAdvisorPanel data={biqAdvisor} onClose=… />` with the same look/content as the previous strip-driven panel (image reference matches Captain Edge + Lineup Pulse cards).

c) **List view** — below `<RosterListView>`, render a 2-column row (50/50 on `md+`):
   - Left: existing `<RosterSidebar … />`
   - Right: `<LineupAdvisorPanel data={biqAdvisor} />` (full content + watermark, no close button)

   Replaces the current full-width sidebar block (lines 682–696).

### 4) /scoring — Ballers.IQ Recap toggle on FP Timeline

`src/pages/ScoringPage.tsx`:
- Remove the always-rendered `<ScoringRecapBlock />` (lines 536–553).
- Add a small `Ballers.IQ` toggle button at the top-right of the **FP TIMELINE** card header (line 557).
- When enabled, render the recap block above the timeline as a paginated row showing **3 cards at a time** with `<` / `>` controls flanking the row (left and right ends).
- Persist the toggle in component state only.
- Update `BallersIQRecapBlock` to accept `pageSize` (default all) + simple internal pagination, OR keep the block intact and add a wrapper `ScoringRecapPager` in `ScoringPage.tsx` that slices `data.insights` into pages of 3.

### 5) /transactions — transparent Ballers.IQ button icon

`src/pages/PlayersPage.tsx` (line 528–537):
- Swap `BallersIQBrand variant="emblem"` for theme-aware transparent wordmarks (same pattern as the Roster header button, lines 470–471 of `RosterPage.tsx`):
  ```
  <BallersIQBrand variant="wordmark" forceTheme="light" transparent className="dark:hidden !h-4 w-auto" />
  <BallersIQBrand variant="wordmark" forceTheme="dark"  transparent className="hidden dark:block !h-4 w-auto" />
  ```
- Drop the trailing "Ballers.IQ" text (the wordmark is the label). Same compact button shell.

### 6) AI Coach modal — auto-Explain + Recent history dropdown

`src/components/AICoachModal.tsx` (Explain tab):
- In `handleSelectExplainPlayer` (line 248) and the `onPickPlayer` Market Watch path, call `aiExplainPlayer` immediately after setting `selectedExplainPlayer` (factor existing `handleExplain` body into `runExplain(target)` and reuse).
- Replace the inline **"Explain"** button (line 504–506) with an icon-only `History` button (lucide `History`) that opens a `DropdownMenu` listing the last 5 entries of `recentExplained` (already persisted to `localStorage`). Selecting an entry calls `runExplain` for that player.
- Remove the existing "Recent" chip row (lines 467–492) since the dropdown replaces it.

### 7) Player Modal — Verdict card polish (light theme)

`src/components/ballers-iq/BallersIQPlayerVerdict.tsx`:
- Replace the single `BallersIQBrand variant="emblem" size="sm"` with a theme-pair using the **transparent** variant:
  - `forceTheme="light" transparent` shown via `dark:hidden`
  - `forceTheme="dark"  transparent` shown via `hidden dark:block`
- Add a wordmark watermark at the **far right** of the card, mirroring the player-modal team-badge watermark pattern: oversized, rotated, very low opacity, `pointer-events-none`, absolutely positioned. Use `ballers-iq-wordmark-light-transparent` / `-dark-transparent` switched by theme.
- Bump card `overflow-hidden` to keep the watermark contained.

### 8) Create Share Card — photo + PNG export

**Photo missing:**
- `src/components/ballers-iq/share/BallersIQShareCard.tsx`: NBA player CDN photos lack CORS headers, so `crossOrigin="anonymous"` causes the browser to drop the image. Drop `crossOrigin` and add `onError` fallback to the team logo or a tinted initials block. The card already receives `imageUrl` from `PlayerModal` (`c.photo`).

**PNG export "unknown error":**
- The error stems from `html-to-image` trying to inline cross-origin images and CSS that uses `radial-gradient` with multiple stops on Tailwind `bg-[radial-gradient(...)]` arbitrary values plus `BallersIQBrand` PNGs from `/brand/`.
- Fixes in `BallersIQShareCardModal.tsx` `handleDownload`:
  - Pre-load player image and brand PNGs into HTMLImageElement with `await img.decode()` to ensure they're rendered before snapshot.
  - Pass `toPng` options:
    ```
    { pixelRatio: 2, cacheBust: true,
      skipFonts: true,
      filter: (node) => !(node instanceof Element && node.tagName === "LINK"),
      imagePlaceholder: <transparent 1x1 dataURL>,
      fetchRequestInit: { mode: "cors" } }
    ```
  - Wrap the call in a try block that, on failure, falls back to `mod.toJpeg` (more lenient with tainted canvas) and surfaces the real error message in the toast (currently swallowed as "Unknown error" because `e?.message` is empty for `SecurityError`).
- Improve toast: show `e?.name + ": " + (e?.message || "see console")` and `console.error(e)` so future failures are diagnosable.

---

## Files touched

- `src/pages/RosterPage.tsx`
- `src/pages/ScoringPage.tsx`
- `src/pages/PlayersPage.tsx`
- `src/components/AICoachModal.tsx`
- `src/components/ballers-iq/BallersIQPlayerVerdict.tsx`
- `src/components/ballers-iq/share/BallersIQShareCard.tsx`
- `src/components/ballers-iq/share/BallersIQShareCardModal.tsx`
- (optional) `src/components/ballers-iq/BallersIQRecapBlock.tsx` if pagination is added there instead of in `ScoringPage`.

No new dependencies. No DB or edge-function changes.
