# Polish Pass — 7 Fixes

## 1) /scoring — Recap Story overlays the FP Timeline (no push-down)
**File:** `src/pages/ScoringPage.tsx`
- Wrap the timeline chart container (line ~540) in `relative`. Render `ScoringRecapBlock` as an **absolute overlay** when `recapOpen`:
  - `absolute inset-x-2 top-12 z-20` (sits below the FP TIMELINE header bar, over the chart).
  - Add a small close (`X`) button inside the recap card to dismiss.
  - Pass `pageSize={3}` (already wired).
- Underlying timeline keeps its height; recap floats over it instead of pushing chart down.

## 2) AI Coach modal → Explain → History dropdown items: add team-badge watermark
**File:** `src/components/AICoachModal.tsx` (lines ~505–525, `recentExplained.map`)
- Make `DropdownMenuItem` `relative overflow-hidden`.
- Inside, render a watermark `<img src={logo} class="pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 h-10 w-10 object-contain opacity-[0.18] rotate-12 select-none">` mirroring the TeamModal header watermark pattern.
- Player photo + name stay on top via `relative z-10`.

## 3) /schedule — strip game-card labels
**File:** `src/components/ballers-iq/GameCardBadges.tsx`
- a) Remove the `recap_ready` (blue "RECAP") badge from `META`, or simpler: in `GameCardBadges` filter it out.
- b) Make the component a no-op: render `null` regardless of badges (kills TRAP GAME / NO OWNED / HIGH CEILING / CAPTAIN). Keeps the import sites untouched.

## 4) /schedule — remove the entire Game Night strip
**File:** `src/pages/SchedulePage.tsx` (lines 563–568)
- Delete the `gameNightSummary` block + the `BallersIQGameNightSummary` import (line 18). Drop the `gameNightSummary` state/build code if unused after removal.

## 5) Player modal — move "Create Card" to header
**Files:** `src/components/PlayerModal.tsx`
- In header action row (lines ~205–220), add a third icon button right after Heart:
  - `<button title="Create Ballers.IQ Share Card"><Share2 className="h-4 w-4 text-amber-400/90" /></button>` that opens `BallersIQShareCardModal`.
- Hoist the modal `open` state + `shareCtx` builder up to the parent `PlayerModal` component (same data already computed in the verdict block — extract once).
- Remove the inline `VerdictWithShare` "Create Card" button row; render `<BallersIQPlayerVerdict>` directly.

## 6) Share Card — broken layout & missing photo (PNG export)
**Files:** `src/components/ballers-iq/share/BallersIQShareCard.tsx`, `BallersIQShareCardModal.tsx`
- **Photo missing in PNG**: NBA player photos are CORS-tainted → `toPng` skips them silently in our current setup. Fix:
  - In `BallersIQShareCard`, fetch the image at render-time via `useEffect` → convert to base64 data URL via `fetch(url).then(r=>r.blob()).then(FileReader)`, fall back to initials on failure. Render `<img src={dataUrl}>` so html-to-image can rasterise it safely.
- **Text overlap (NIKOLA / JOKIĆ stacked over subtitle)**: the subject `<h1>` uses oversized line-height and the subtitle is positioned absolutely behind it. Restructure subject block:
  - Use a flex column with explicit `gap-2`, `leading-[0.95]`, `whitespace-nowrap`, and split first/last name on space → render as two `<span class="block">` lines with controlled spacing.
  - Move subtitle to a separate row **below** the name with `mt-3`, smaller font.
- **Bullet text stacked over headline (Wide preview)**: the bullets list sits in `bottom-44/28` while body uses huge font; reduce headline to `text-[36px]` (square) / `text-[28px]` (wide) and bump bottom padding.
- Re-test square + wide: name on two lines, subtitle clear, bullets aligned.

## 7) /transactions — Players table default to All
**File:** `src/pages/PlayersPage.tsx` (line 48)
- `useState<PageSizeOption>("All")` instead of `20`.

## 8) /advanced — All Actions dropdown clipped at "Ejection"
**File:** `src/pages/AdvancedPage.tsx` (line 440)
- `CommandList` currently `max-h-[320px]` and the popover sits inside a constrained container — Ejection is hidden behind viewport edge.
- Bump `max-h-[60vh]` and add `overflow-y-auto`. Also ensure `PopoverContent` has `collisionPadding={12}` so Radix flips/scrolls when near bottom.

---

## Technical notes
- No new dependencies.
- Watermark pattern reused from `TeamModal` header (`opacity-[0.18] rotate-12`).
- Share card photo fix uses a small `useEffect` + `FileReader` — no library change. JPEG fallback already in place.
- `GameCardBadges` becoming a no-op is the smallest-blast-radius way to kill all top-right schedule labels without touching every render site.
