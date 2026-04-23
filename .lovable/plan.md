

## /transactions polish + onboarding hero reflow

### 1. My Roster (left column)

**a) Wider roster + tighter Player→Team in table**  
- Bump roster column from `w-72` → `w-80` (320px) so player names like "Victor Wembanyama" fit fully.  
- In the players table, set the Player `<TableHead>` and `<td>` to `whitespace-nowrap` (already there) and reduce its right padding so it sits flush against the Team column. Concretely: give Player cell `pr-1` and Team cell `pl-1`, and lower its column width by adding `style={{ width: "1%" }}` so the table no longer stretches Player to fill space — Team now sits right next to the name.

**b) Header height parity with table header**  
- Both the roster header and the new dedicated table header strip will be `h-10` exactly. Currently the roster header is `h-10` but the table header is rendered inside `<Table>` so its rendered height differs (~36px). Fix by wrapping the `<TableHeader>` row contents to enforce `h-10` via a class on `<TableRow>` (`className="h-10"`), and ensure the roster header uses the same vertical alignment classes.

**c) Footer text styling — bold NBA-yellow, centered**  
- Roster footer: change from left-aligned muted to `justify-center` + `font-bold text-[hsl(var(--nba-yellow))]`.  
- Same treatment for the table's footer "of 490 players" text (item 3b).

### 2. Filters panel — `−`/`+` toggles

- Replace the `ChevronRight` (collapse) icon with a `Minus` icon, placed at the **top-right corner of the filters card** (absolute positioned, e.g. `absolute top-2 right-2` inside the FiltersPanel wrapper, so it visually belongs to the filters card itself, not floating outside).  
- Replace the `ChevronLeft` icon (expand) with a `Plus` icon. Move it to sit at the **top-left corner of the table card** (absolute positioned just outside or inside the table's top-right edge). When filters are collapsed, the current vertical strip is replaced by a small `+` button anchored to the table's top-right corner — clicking it re-expands the filters panel.  
- Keep tooltips: "Collapse filters" / "Expand filters". Remove the vertical "Filters" label strip entirely; the `+` corner button is enough.

### 3. Players table — TRULY fixed header + yellow footer

**a) Real fixed header (not just sticky)**  
The current `sticky top-0` approach inside an `overflow-y-auto` div should work — but in screenshots it's drifting. Root cause: the table uses `position: relative` and `<tbody>` rows have `transform/hover` styles that create stacking contexts, and the sticky header's `bg-background` with inset shadow only — combined with `<TableRow>` not having an explicit background — lets rows render *over* the header in some browsers because the body container's scroll origin moves the table.

Switch to a **two-table split** with synced column widths via `<colgroup>`:

```tsx
<div className="flex-1 min-h-0 flex flex-col">
  {/* Fixed header (no scroll) */}
  <div className="shrink-0 border-b bg-background">
    <Table className="table-fixed">
      <colgroup>{COLS.map(c => <col key={c.key} style={{ width: c.width }} />)}</colgroup>
      <TableHeader><TableRow className="h-10">...</TableRow></TableHeader>
    </Table>
  </div>
  {/* Scrollable body (no thead) */}
  <div className="flex-1 overflow-y-auto min-h-0">
    <Table className="table-fixed">
      <colgroup>{COLS.map(c => <col key={c.key} style={{ width: c.width }} />)}</colgroup>
      <TableBody>...</TableBody>
    </Table>
  </div>
</div>
```

Define the `COLS` array once with explicit pixel widths (e.g. `w-12` icon col → 48px, Player → auto/`*`, Team → 80px, GP/PTS/MP/REB/AST/STL/BLK/FP/$ → 56px each). Both `<colgroup>`s reference it so columns stay aligned even with no shared `<table>` element. This guarantees the header **never moves** regardless of body scroll position or row count.

**b) Footer text bold NBA-yellow**  
"of 490 players" + "Show" label → `font-bold text-[hsl(var(--nba-yellow))]`. Keep the Select trigger neutral so it matches other selects.

### 4. Onboarding hero — CTA cluster overlaps the marquee

In `OnboardingHero.tsx`, restructure `<main>` so:
- `Welcome to` + `DRAFT YOUR / SQUAD` headline + tagline render at the top portion (above the marquee strip area).  
- The CTA cluster (`Start Your Draft` button + `3 quick steps` + `Skip for now →`) is moved into a wrapper with `mt-auto` so it docks at the **bottom** of the hero, just below where the player marquee strip sits — overlapping the lower ~25% of the marquee strip on purpose, exactly as requested.  
- Add `relative z-20` to the CTA wrapper so it sits visually above the marquee photos.  
- The marquee currently uses `top-1/2 -translate-y-1/2`. Keep that — the CTA dropping into the lower half will naturally overlap the bottom portion of the strip.  
- The "$100M Cap / 10 Players / 5 FC + 5 BC / 1 Captain · 2× FP" chips row stays at the very bottom of the page (already `mt-auto`); CTA cluster sits just above it but below the headline.

Visual order top→bottom after change:
```
[Welcome to]
[DRAFT YOUR / SQUAD]            ← headline (top half)
[tagline]
————— marquee strip (centered) —————
[Start Your Draft]              ← CTA cluster (overlaps lower marquee)
[3 quick steps]
[Skip for now →]
[$100M Cap · 10 Players · ...]  ← spec chips (bottom)
```

### Files touched

- `src/pages/PlayersPage.tsx`
  - Roster column `w-72` → `w-80`.
  - Roster footer: `justify-center` + bold NBA-yellow.
  - Filters toggle: replace `ChevronRight` with `Minus` icon, move INSIDE FiltersPanel top-right corner. Replace `ChevronLeft` strip with a small `Plus` button anchored at the table card's top-right corner.
  - Players table: split into header-table + body-table with shared `<colgroup>` widths to make header truly fixed.
  - Footer: "Show" + "of N players" → bold NBA-yellow.

- `src/components/FiltersPanel.tsx` (light edit)
  - Add a `relative` wrapper and slot in the `Minus` collapse button at `absolute top-2 right-2`. (Pass `onCollapse` prop from PlayersPage.)

- `src/components/onboarding/OnboardingHero.tsx`
  - Restructure `<main>` flex so headline sits at top, CTA cluster docks at bottom (`mt-auto` on the CTA wrapper), with `relative z-20` to sit over the marquee strip.

### Out of scope

- Drag & drop between roster and table.
- Filters drawer for very narrow viewports (filters already hide on `< 1280px` via existing logic; the `+`/`−` toggle is for ≥1280px desktop).
- Marquee animation timing or photo selection.

