

## Roster row + Player Action — premium watermark treatment

Same watermark effect already used in TradeReport player IN/OUT cards: oversized team logo, low opacity, rotated, anchored to top-right corner (escapes its container).

### 1. My Roster (left column, /transactions)

**a) More width**  
In `src/pages/PlayersPage.tsx` line 581, bump roster shell from `w-80` → `w-96` (384px). The right table absorbs the change automatically (Player column is flex-auto, stat columns stay at their fixed 44px widths).

Also bump the mobile Sheet (line 481) from `w-72` → `w-80` for consistency.

**b) Watermark team logo on each row** (`src/components/transactions/RosterPane.tsx`)

Edit `RosterRow`:
- Make wrapper `relative overflow-hidden` so the watermark can clip nicely to the row's rounded edges.
- Remove the inline 16×16 team logo `<img>` (line 73).
- Add an oversized watermark logo, mirroring the TradeReport effect but scaled for the row height (~36px tall):
  ```tsx
  {teamLogo && (
    <img
      src={teamLogo}
      alt=""
      aria-hidden
      className="pointer-events-none absolute -top-3 -right-3 h-16 w-16 object-contain opacity-[0.18] rotate-12 select-none"
    />
  )}
  ```
- Wrap the existing row content in `<div className="relative z-10 flex items-center gap-1.5 w-full">` so the [-] button, avatar, FC/BC badge, name and salary stay above the watermark.
- The salary `<span>` keeps its current spot at the far right; the watermark sits behind it, peeking past on the upper-right.

Result: each roster row reads as a "team-coloured card" without needing a small badge — matches the IN/OUT card vibe in the Trade Report exactly.

### 2. /advanced — Player Action picker (`src/pages/AdvancedPage.tsx`, `PlayerCombobox`)

Two surfaces to update:

**a) Selected-player trigger button** (lines 59–73)
- Add `relative overflow-hidden` to the trigger.
- Remove the inline 16×16 `selectedLogo` img (line 69).
- Insert a watermark logo with the same recipe (sized for the h-10 trigger):
  ```tsx
  {selectedLogo && (
    <img
      src={selectedLogo}
      alt=""
      aria-hidden
      className="pointer-events-none absolute -top-4 -right-4 h-20 w-20 object-contain opacity-[0.18] rotate-12 select-none"
    />
  )}
  ```
- Wrap the inner content (`photo + name`) in `relative z-10` so it stays above the watermark.

**b) Dropdown player rows** (lines 91–130)
The combobox already has a watermark logo (line 100), but it's smaller (`w-9 h-9 opacity-[0.12]`) and right-centered. Upgrade it to match the TradeReport recipe exactly:
```tsx
className="pointer-events-none absolute -top-4 -right-4 h-20 w-20 object-contain opacity-[0.18] rotate-12 select-none group-hover:opacity-[0.28] transition-opacity"
```
Also remove the `mr-8` reservation on the `<Check>` icon (line 127) → revert to `mr-2`, since there's no inline logo to dodge anymore. The check still floats above the watermark thanks to `relative z-10` on its parent.

### Files touched

- `src/pages/PlayersPage.tsx` — `w-80` → `w-96` (line 581); Sheet `w-72` → `w-80` (line 481).
- `src/components/transactions/RosterPane.tsx` — `RosterRow`: add `relative overflow-hidden`, remove inline team logo, add oversized rotated watermark, wrap content in `relative z-10`.
- `src/pages/AdvancedPage.tsx` — `PlayerCombobox`: add watermark to selected trigger button (remove inline logo), upgrade dropdown row watermark to match TradeReport sizing/opacity/rotation, drop `mr-8` on Check icon.

### Out of scope

- Watermark on the right-side players table rows (table is data-dense; would clutter).
- Watermark on the FiltersPanel team picker.
- Color theming the watermark by team primary color (logo PNG opacity is enough).

