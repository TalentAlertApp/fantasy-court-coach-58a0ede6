## Scope

Two surgical changes:

1. **Ballers.IQ slide watermark** — league-aware corner brand image (NBA or WNBA) using the exact same overlay treatment as the team-badge watermark on the Played Games Recap slide.
2. **Team of the Week positioning** — make it visually identical in structure to the `/MY ROSTER` Starting 5 court by reusing the same shared coordinate logic and giving the court enough room to render at the same scale.

No card redesign. No new positioning system.

---

## 1) Ballers.IQ slide league watermark

Files:
- Copy `user-uploads://NBA_BALLERSIQ.png` → `public/brand/ballers-iq-league-nba.png`
- Copy `user-uploads://WNBA_BALLERSIQ.png` → `public/brand/ballers-iq-league-wnba.png`
- Edit `src/components/court-show/CourtShowSlide.tsx`

Change:
- Import `useLeague` from `@/contexts/LeagueContext`.
- When `slide.payload.kind === "ballersiq"`, render an additional `<img>` watermark in the same place and with the same classes used today by the team-badge recap watermark:

```
className="pointer-events-none absolute -top-16 -right-16 h-[420px] w-[420px] object-contain opacity-[0.13] blur-md select-none"
```

…with `src` resolved to `/brand/ballers-iq-league-nba.png` or `/brand/ballers-iq-league-wnba.png` based on `useLeague().league`. Suppress the existing team-tricode watermark for `ballersiq` slides (it is already null by virtue of the switch, since `ballersiq` is not in the `watermarkTri` chain — confirmed) so the league watermark stands alone.

No layout, header, or content changes to the BIQ slide otherwise.

---

## 2) Team of the Week — mirror Starting 5 court exactly

Root cause of the mismatch (already verified in code):
- Both components already share `getRowPositions(count, "28%" | "72%")` via `src/lib/court-layout.ts` — the **coordinates are already shared**.
- The visual mismatch comes from the **container**, not the coordinate system:
  - TOTW modal uses `max-w-4xl` and the court uses `aspectRatio: 16/9`, producing a court that is too short for cards anchored at 28%/72%, so the bottom row visually clips and labels collide.
  - TOTW slot wrapper is fixed `w-[22%]` while Starting 5 uses responsive `w-[26%] md:w-[24%] lg:w-[22%]`.

Files:
- `src/components/TeamOfTheWeekModal.tsx` (only file touched for this fix)

Changes (no new positioning system; reuses the existing shared helper):

a) Extract a tiny shared helper used by **both** Starting 5 and TOTW so the contract is explicit:
- New export in `src/lib/court-layout.ts`: `getCourtFormation<T>(items, getFcBc, topFc="28%", topBc="72%")` returning `{ item, style }[]`. Refactor `RosterCourtView.getFormationPositions` and `TeamOfTheWeekModal.getFormation` to call it. Single source of truth, identical anchors, identical row tops, identical fallback behaviour.

b) Match the Starting 5 court container so cards render at the same effective scale:
- Replace `<DialogContent className="max-w-4xl">` with `max-w-6xl` (closer to Starting 5 court width on desktop).
- Replace `aspectRatio: "16/9"` on the court div with `min-h-[640px] aspect-[16/10]` (taller envelope so 28%/72% rows have the same vertical breathing room as Starting 5; 16/10 mirrors the real Starting 5 area on common viewports while staying responsive).
- Replace each player wrapper's fixed `w-[22%]` with the responsive `w-[26%] md:w-[24%] lg:w-[22%]` used by Starting 5.

c) Keep `TOTWCard` visuals (photo sizes, badges, FP pill) untouched per the explicit "do NOT redesign cards" rule. Only the **positioning envelope** changes.

Verification (visual checklist after change):
- 3 FC + 2 BC: 3 evenly spread on top row (12/31/50/69/88 collapses to 20/50/80 for n=3), 2 on bottom row at 33/67 — identical to Starting 5.
- 2 FC + 3 BC: mirrored — identical to Starting 5.
- No clipping at modal edges; no label/photo overlap between rows.
- Both NBA and WNBA renders identical.

---

## Out of scope

- Court background art, player card visuals, FP pill styling, wishlist heart, modal chrome.
- Any change to the Played Games Recap slide.
- Any change to scoring or roster business logic.