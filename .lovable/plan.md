## 1) /teams — Standings: pin Ballers.IQ cards to bottom of sidebar

**File:** `src/pages/TeamsPage.tsx`

The standings view already uses a flex column with `mt-auto` on the BIQ row, but its outer height (`h-[calc(100vh-180px)]`) doesn't reach the bottom of the left sidebar (which extends to the viewport edge).

- Replace the wrapper height with a fill-height layout so the BIQ row sits flush with the sidebar bottom:
  - Change outer `<div className="space-y-4">` (page root) to `<div className="flex flex-col h-full min-h-0">` so the page consumes the AppLayout's available height.
  - Header row stays `shrink-0`.
  - Replace `<div className="flex flex-col gap-3 h-[calc(100vh-180px)]">` with `<div className="flex-1 min-h-0 flex flex-col gap-3">`.
  - Keep the scrollable standings (`flex-1 min-h-0 overflow-auto`) and the BIQ block (`shrink-0 mt-auto`) as-is — now the bottom edge of the BIQ section will align with the bottom of the persistent left sidebar.

No visual change to Teams tab.

## 2) /MY ROSTER — Header & toolbar polish

**File:** `src/pages/RosterPage.tsx`

### a) Ballers.IQ button — transparent image (light theme)
The dark theme already uses `ballers-iq-wordmark-dark-transparent.png`. The light theme variant is currently the non-transparent `wordmark-light`. Update the light branch:
```tsx
<BallersIQBrand variant="wordmark" forceTheme="light" transparent className="dark:hidden !h-4 w-auto" />
```
(adds `transparent` so the PNG background no longer overlaps the button bg).

### b) Ballers.IQ + WISHLIST buttons — same width
Wrap both with a fixed width class so they match exactly:
- Ballers.IQ button: add `w-32 justify-center` (replaces ad-hoc `px-3`).
- Wishlist `<Button>`: add `w-32 justify-center` and keep `Heart` + label.

### c) LINEUP ADVISOR / SCHEDULE / CHIPS / OPTIMIZE — equal width + per-button hover color + new LA icon
Apply `w-40 justify-center` to all four buttons (same uniform pill).

Per-button hover tints (using existing palette tokens — distinct, on-brand):
- **Lineup Advisor** — amber (already has `border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-400`). Keep.
- **Schedule** — sky: `hover:bg-sky-400/10 hover:text-sky-400 hover:border-sky-400/60`.
- **Chips** — violet: `hover:bg-violet-400/10 hover:text-violet-400 hover:border-violet-400/60`.
- **Optimize** — keep existing yellow/orange hover, plus border highlight.

Replace the `Sparkles` icon on the **Lineup Advisor** button with the Ballers.IQ emblem so it's no longer duplicated with the Chips button:
```tsx
<BallersIQBrand
  variant="emblem"
  forceTheme="light"
  transparent
  className="!h-4 !w-4 mr-1 opacity-90"
/>
```
The `light + transparent` emblem PNG embeds cleanly on both light and dark button backgrounds (already used the same way inside `BallersIQCard` and `BallersIQRecapBlock`).

Chips button keeps its `Sparkles` icon — no other icon changes.

### Technical notes
- No state, handler, or data-flow changes.
- No new assets — `ballers-iq-wordmark-light-transparent.png` and `ballers-iq-emblem-light-transparent.png` already exist in `public/brand/`.
- Pure className/markup edits in two files: `src/pages/TeamsPage.tsx` and `src/pages/RosterPage.tsx`.
