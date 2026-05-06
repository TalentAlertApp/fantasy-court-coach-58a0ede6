# Polish: Roster slots, FP picker, Compare modal & watermarks

## 1) My Roster

### a) Court — bench width (no clipped slots)
`RosterCourtView.tsx`: widen bench column from `w-72` to `w-80` (or `w-[22rem]`) so the 7 opponent slots in `PlayerCard` bench variant fit on one line. The court area uses `flex-1`, so it auto-shrinks.

### b) List — opponent strip placement & team badge order
`PlayerRow.tsx` (player cell):
- Reorder team line to: **logo → tricode → opponent slots**, where the slots get a left margin (`ml-3`) so they sit visibly apart from the team details (currently `ml-1`, too tight).
- Move `{teamLogo}` to render **before** `{core.team}` text.

### c) Opponent badges — tooltip polish (Court + List)
Both `PlayerCard.tsx` (`slotFor`) and `PlayerRow.tsx` (inline tooltip):
- Empty day: title = `"No game scheduled"` (currently `undefined`).
- Home label: drop the `"vs"` prefix → just `OPP` (e.g. `UTA · Sun 12 Apr · 21:30 · Easy`). Away keeps `@OPP`.
- Append difficulty score when known: `"… · Easy (62)"` using the same `difficultyMap[opp].label` + `score`.
- Centralize via the existing `difficultyTooltip` helper in `lib/ballers-iq/difficultyColor.ts` (extend it: `difficultyTooltip(opp, isHome, label, score, tipoffLabel)` and have it return `"OPP · …"` when home, `"@OPP · …"` when away; for null day return `"No game scheduled"`).

### d) List view watermark too big
`RosterListView.tsx`: shrink the fixed NBA logo from `w-[30vw] max-w-[480px] opacity-[0.04]` → `w-[14vw] max-w-[220px] opacity-[0.05]`.

## 2) ScoringPage — FP Timeline picker

`ScoringPage.tsx` (lines 628-684):
- **Compact card**: reduce photo from `w-12 h-12` → `w-9 h-9`, ring padding `p-[2px]` → `p-[1.5px]`, vertical padding `py-2` → `py-1.5`, name `text-sm` → `text-xs`. Watermark shrink `h-16 w-16` → `h-12 w-12`.
- **Scrollable list**: wrap the `space-y-1.5` block in a `max-h-[480px] overflow-y-auto pr-1` container so all 10 fit and scroll cleanly inside the popover.
- **FC/BC chip color**: replace the plain `{p.team} · {p.fc_bc}` text with a real `Badge` using `variant={p.fc_bc==='FC'?'destructive':'default'}` (same red/blue scheme used in `PlayerCard`/`PlayerRow`).

## 3) Team modal — Compare dropdown not scrolling

`TeamModal.tsx` line 181: the popover uses `max-h-[60vh] overflow-y-auto` directly on `PopoverContent`, but Radix Popover content inside Dialog can swallow wheel events. Fix:
- Replace inline overflow with a nested wrapper: `<PopoverContent align="end" className="w-56 p-2"><div className="max-h-[60vh] overflow-y-auto pr-1">…</div></PopoverContent>`.
- Add `onWheel={(e)=>e.stopPropagation()}` on the scroll wrapper to prevent the underlying Dialog ScrollArea from intercepting the wheel.

## 4) Team Compare modal — watermark on Standings card

`TeamCompareModal.tsx` (Standings & Form section): wrap the metrics card with `relative overflow-hidden` and add an absolutely-positioned, centered NBA logo `<img src={nbaLogo} … className="pointer-events-none absolute inset-0 m-auto h-40 w-40 opacity-[0.05] select-none" />` behind the rows (`relative z-10` on the rows wrapper).

## Files touched
- `src/components/RosterCourtView.tsx`
- `src/components/RosterListView.tsx`
- `src/components/PlayerCard.tsx`
- `src/components/PlayerRow.tsx`
- `src/lib/ballers-iq/difficultyColor.ts` (extend `difficultyTooltip`)
- `src/pages/ScoringPage.tsx`
- `src/components/TeamModal.tsx`
- `src/components/TeamCompareModal.tsx`

No new deps, no schema changes.
