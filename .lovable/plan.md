

## Plan: Players-of-the-Day swap, day tab borders, and Injury Report shortcut

### 1. `/schedule` Players of the Day — swap photo ↔ team logo (with effects)
File: `src/components/TopPlayersStrip.tsx` (`renderPlayer`)

Currently the team logo is the watermarked background that scales/brightens on hover, and the player photo is the small foreground avatar. Swap their roles:

- **New background (watermark with surge)**: render the **player photo** as the absolutely-positioned watermark.
  - Replace the existing `<img src={getTeamLogo(p.team)} ... opacity-30 group-hover:scale-125 group-hover:opacity-60 />` with an `<img src={p.photo} ... />` using the same opacity/transition/group-hover classes (`opacity-30 → group-hover:opacity-60`, `group-hover:scale-125`).
  - Keep `object-contain` and the same h-14/w-14 sizing so the watermark behaves identically.
  - If `p.photo` is missing, fall back to the team logo so the row never goes blank.
- **New foreground avatar**: render the **team logo** in place of the current `<Avatar>` (the small h-8 w-8 element next to the FC/BC badge).
  - Use the same `<Avatar className="relative z-10 h-8 w-8 shrink-0">` wrapper, with `<AvatarImage src={getTeamLogo(p.team)!} className="object-contain p-0.5" />` and an `AvatarFallback` of the tricode (e.g. first 3 letters of `p.team`).
- All other elements unchanged: FC/BC badge stays on the left, name + team + salary stay center, FP / value number stays on the right with the same `relative z-10` stacking. Hover behaviour (scale 1.25, opacity surge to 0.60) is preserved — it now applies to the player photo instead of the team logo.

This affects both the **Fantasy Points** and **Value (FP/$)** tabs, FC and BC sides, because all four lists go through the same `renderPlayer` function.

### 2. `/schedule` daily day-tab visual separation
File: `src/pages/SchedulePage.tsx` (the "Day Navigator" block at lines ~133-194)

Right now the day tabs sit flush next to each other inside the `<div className="flex-1 flex overflow-x-auto scrollbar-hide">` strip with no separators. Add subtle vertical dividers so the user can clearly see each tab's boundary.

- On every day `<button>`, add `border-r border-border/60 last:border-r-0` so each tab gets a 1px right divider, except the final one.
- Drop `rounded-xl` from the unselected state (it currently rounds corners that don't visually exist due to the flush layout) and keep `rounded-xl` only when `isSelected` so the active tab still pops as a rounded pill.
- Concrete className change:
  ```tsx
  className={`flex-1 min-w-[80px] py-2 px-2 transition-all border-r border-border/60 last:border-r-0 ${
    isSelected
      ? "bg-primary text-primary-foreground shadow-md rounded-xl border-r-transparent"
      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
  }`}
  ```
- Result: each day tab has a clear vertical divider, the active tab still renders as a rounded primary pill, and dark-mode contrast stays consistent via `border-border/60`.

### 3. `/schedule` Injury Report shortcut icon
File: `src/pages/SchedulePage.tsx`

Add a small shield icon button that opens the existing `<InjuryReportModal>` directly — same modal already triggered from the AI Coach → Injuries → "Scan Injuries" flow on `/`.

- Import `InjuryReportModal` from `@/components/InjuryReportModal` and the `Shield` icon from `lucide-react`.
- Add local state `const [injuryOpen, setInjuryOpen] = useState(false);`.
- In the icon row right before the existing `Grid3X3` button (line ~217-223), insert:
  ```tsx
  <button
    onClick={() => setInjuryOpen(true)}
    className="text-muted-foreground hover:text-foreground transition-colors p-1"
    title="Injury Report"
    aria-label="Open injury report"
  >
    <Shield className="h-4 w-4" />
  </button>
  ```
- At the bottom of the component (next to `<TeamOfTheWeekModal …/>`), render:
  ```tsx
  <InjuryReportModal open={injuryOpen} onOpenChange={setInjuryOpen} />
  ```
- The modal is fully self-contained: it lazy-loads the injury report from the `nba-injury-report` edge function (with its own 30 min localStorage cache) on first open, exactly as it does from the AI Coach. No prop wiring needed. Closing the modal returns the user to the schedule view.

### Files touched
- `src/components/TopPlayersStrip.tsx` — swap player photo and team logo positions in `renderPlayer`, preserving the hover surge effect.
- `src/pages/SchedulePage.tsx` — add `border-r border-border/60 last:border-r-0` to day-tab buttons; add a Shield icon button before the Grid3X3 link that opens the existing `InjuryReportModal`.

### Verification
- `/schedule` → Players of the Day, both tabs (Fantasy Points and Value), FC and BC: each player row now shows the team logo as the small avatar on the left and the **player photo** as a larger faded watermark behind it; hovering the row makes the player-photo watermark scale up and brighten (the same surge effect previously applied to the team logo).
- `/schedule` day strip: every day tab has a clear vertical divider line between it and its neighbours; the active day still renders as a rounded primary pill.
- `/schedule` icon row: a shield icon sits immediately to the left of the existing Grid3X3 (advanced grid) icon. Clicking it opens the league-wide Injury Report modal — identical to the modal opened from the AI Coach → Injuries → Scan Injuries flow on the My Roster page.

