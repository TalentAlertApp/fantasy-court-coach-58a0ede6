

## Four polish fixes — Pick Your Team grid, Trade workbench buttons, table FC/BC, Schedule dropdown badges

### 1. Pick Your Team — equalize all card sizes (`src/pages/TeamPickerPage.tsx`)

Cards currently grow to fit their content (description vs. no description), so the "New Team" tile is taller than empty ones (image-289 confirms the visual inconsistency). Fix:

- Add `h-44` (or `min-h-[11rem]`) to every card and the New-Team card so all tiles share identical height regardless of content length.
- Shorten the New-Team description from "Spin up another franchise from scratch." → **"Start fresh."** (keeps tone, fits the smaller card cleanly).
- Wrap the description block in a fixed-height container with `overflow-hidden` so a long team description never pushes layout out (`line-clamp-2` already in place — keep).
- Grid stays `auto-fit, minmax(220px, 1fr)`; widths already equalize via grid, only heights need locking.

### 2. /transactions — Trade workbench reflow (`src/components/transactions/TradeWorkbench.tsx`)

**a) Move REPORT and RESET inline with the VALID pill** (Row 1)

Currently: Row 1 = metrics + GW pill + status pill. Row 2 = chips + Reset + Report.  
After: Row 1 = metrics + GW pill + status pill + **TRADE button** + **Reset icon-button** (all right-aligned via `ml-auto` on the action cluster). Row 2 = ONLY the OUT/IN player chips (no buttons).

This means moving the Reset + Report (rebranded TRADE) controls out of Row 2 into Row 1's right edge. Wrap them in a `flex items-center gap-1.5 ml-auto` cluster appended after the status pill.

**b) Rename REPORT → TRADE with surge effect**

Replace the existing REPORT button content/styling:
- Label: `TRADE` (or `Refresh` while open — same conditional logic).
- Add a premium "surging" effect: pulsing accent glow + subtle scale on hover. Concretely:
  ```tsx
  className="rounded-lg h-8 font-heading uppercase text-[10px] gap-1.5 
             bg-accent text-accent-foreground 
             shadow-[0_0_20px_-2px_hsl(var(--accent)/0.6)] 
             hover:shadow-[0_0_30px_-2px_hsl(var(--accent))] 
             hover:scale-[1.04] active:scale-[0.98] 
             transition-all duration-200
             relative overflow-hidden
             after:absolute after:inset-0 after:rounded-lg 
             after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent
             after:translate-x-[-100%] hover:after:translate-x-[100%] 
             after:transition-transform after:duration-700"
  ```
  Sweeping shimmer on hover + persistent accent glow communicates "this is the finishing action."
- Keep `onClick={onGenerateReport}`, the same modal name ("TRADE REPORT"), and all internal logic intact. Only the button label and visuals change.

**c) Replace RESET text button with context-sensitive icon**

Replace the "Reset" outline button with an icon-only ghost button using `RotateCcw` (lucide):
```tsx
<Button
  size="icon"
  variant="ghost"
  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
  onClick={onReset}
  title="Clear all staged players"
  aria-label="Reset trade"
>
  <RotateCcw className="h-4 w-4" />
</Button>
```
Only renders when `hasChips` (same condition as today). Sits to the LEFT of the TRADE button so the destructive/clear action precedes the commit-style action.

**Visibility rules for Row 1 cluster:**
- Reset icon: render when `hasChips`.
- TRADE button: render when `canGenerate` (swap mode) OR `isDirectAdd` && `canConfirmAdd` (ADD mode — keep the existing "Confirm Add" branch intact, also moved into Row 1).
- When neither condition is met, Row 1 ends at the status pill.

**Row 2** then becomes purely chip display:
```tsx
{(hasChips || isDirectAdd) && (
  <div className="flex items-center gap-2 flex-wrap">
    {outs.map(...)}
    {ins.map(...)}
  </div>
)}
```
No more button cluster on Row 2.

**d) FC/BC badge consistency in the right-side players table** (`src/pages/PlayersPage.tsx` line 750)

Roster pane uses:
```tsx
<Badge variant={fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-1 py-0 rounded-md shrink-0">{fc_bc}</Badge>
```

Right-side table currently uses `px-0.5 py-0 rounded-lg` (different padding + radius). Update line 750 to match the roster pane exactly:
```tsx
className="text-[7px] px-1 py-0 rounded-md shrink-0"
```

This is a 1-line attribute change for visual parity.

### 3. Schedule dropdown — premium watermark badges (`src/components/SchedulePreviewPanel.tsx`)

The matchup card today uses two crisp 56×56 logos at the far ends with hover scale + colored drop-shadow (lines 402-412 and 482-492). Replace those crisp inline badges with the **same oversized rotated low-opacity watermark recipe used in TradeReport IN/OUT cards**.

For each side (away at far-left, home at far-right):
- Drop the explicit 56×56 logo container.
- Anchor an oversized watermark logo absolutely on the **outer edge** of the matchup card (top corner pulled out past the rounded edge — same effect as TradeReport).

```tsx
{/* Away watermark — top-LEFT corner, escaping the card */}
{awayLogo && (
  <img
    src={awayLogo}
    alt={awayName}
    aria-hidden
    className="pointer-events-none absolute -top-3 -left-3 h-20 w-20 object-contain 
               opacity-[0.20] -rotate-12 select-none 
               group-hover:opacity-[0.32] group-hover:scale-110 
               transition-all duration-300"
  />
)}
{/* Home watermark — top-RIGHT corner, escaping the card */}
{homeLogo && (
  <img
    src={homeLogo}
    alt={homeName}
    aria-hidden
    className="pointer-events-none absolute -top-3 -right-3 h-20 w-20 object-contain 
               opacity-[0.20] rotate-12 select-none 
               group-hover:opacity-[0.32] group-hover:scale-110 
               transition-all duration-300"
  />
)}
```

Layout adjustments since the inline badge slots disappear:
- Remove the two `<div className="... w-14">` badge containers (lines 402-412 and 482-492).
- The outer card already has `relative overflow-hidden` — keep `relative` but **change `overflow-hidden` → `overflow-visible`** ONLY for the watermark images to bleed past the card edge. To keep the venue arena image clipped, wrap the venue `<img>` + gradient in their own `absolute inset-0 overflow-hidden rounded-lg` div. That way watermarks escape but the venue art still respects the card's rounded corners.
- The away cluster (line 415) and home cluster (line 453) keep `flex-1 min-w-0` — they now span the full width minus the center @+time anchor. Add a touch of horizontal padding (`px-3` on the row) so name text doesn't collide with the watermarks in the corners.
- Yellow highlight border on involved games (`border-l-[hsl(var(--nba-yellow))]`) stays.

This matches the TradeReport "premium card invaded by big rotated team logo" look exactly, applied symmetrically to both teams (top-left for away, top-right for home).

### Files touched

1. `src/pages/TeamPickerPage.tsx` — add fixed height (`h-44`) to all cards; shorten New Team copy; ensure description block clamps without changing card height.
2. `src/components/transactions/TradeWorkbench.tsx` — restructure to put Reset (icon) + TRADE (renamed, with surge effect) + Confirm Add inline at the right edge of Row 1; Row 2 becomes chip-only. Import `RotateCcw` from lucide-react.
3. `src/pages/PlayersPage.tsx` — single-line Badge className change on line 750 to match roster pane (`px-1 py-0 rounded-md`).
4. `src/components/SchedulePreviewPanel.tsx` — `MatchupCard`: remove the two inline 56×56 badge slots; add two oversized rotated watermark `<img>` tags anchored to top-left/top-right of the card; wrap venue art in inner clipped div so watermarks can bleed past the rounded edge.

### Out of scope

- Backfilling team `description` for older teams in the picker (just shortening the new-team copy is enough).
- Changing the TRADE REPORT modal itself (name, content, layout all preserved).
- Reordering/restyling the metric pills in Row 1 (Bank/Freed/Spent/Available/GW unchanged).
- Touching the Schedule preview's GW selector or day chips — only the matchup card visual changes.

