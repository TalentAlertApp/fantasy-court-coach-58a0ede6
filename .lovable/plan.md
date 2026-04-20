

## Plan: Injury status filter + Schedule Team-of-the-Week & Top Players card redesign

### 1. Injury Report Modal — status filter chip row
File: `src/components/InjuryReportModal.tsx`

Add a horizontal chip row directly under the existing `ALL | Team dropdown` header bar, inside the same sticky header container.

Chips (left → right): `All` · `Out` · `Day-To-Day` · `Questionable` · `Probable`.

- New state: `const [statusFilter, setStatusFilter] = useState<"all"|"Out"|"Day-To-Day"|"Questionable"|"Probable">("all")`.
- Chip styling: small pill buttons (`h-6 px-2 text-[10px] font-heading uppercase tracking-wider rounded-md`). Each chip uses its own status color (reuse existing `statusClasses`) with a dimmer state when not active and full-color + ring when active. The "All" chip uses neutral muted styling.
- Each chip shows its live count next to the label, computed from the currently-visible dataset (after the team-tab + "My Roster only" filters but BEFORE the status filter is applied), so users always see how many would match if they pick that status.
- Apply the status filter as a final pass on `visibleItems`:
  ```ts
  const finalItems = statusFilter === "all"
    ? visibleItems
    : visibleItems.filter(r => r.status === statusFilter);
  ```
- Pass `finalItems` to `<InjuryList />`.
- If a chip yields 0 rows, show the existing empty state ("No reported injuries"); the chip stays clickable so the user can switch back.
- Layout: place the chip row just below the `[ALL] | [Team Select]` grid, inside the same sticky header (`px-3 pb-2`), centered, wrapping on narrow widths.

### 2. `/schedule` — Team of the Week modal: reuse Starting 5 layout
File: `src/components/TeamOfTheWeekModal.tsx`

Replace the current bespoke `TOTWCard` with the cinematic Court styling already used by `RosterCourtView`'s Starting 5.

Approach (no shared-component refactor; keep changes scoped):
- Lift the formation positioning logic from `RosterCourtView` (`getRowPositions` 28% / 72%, `getFormationPositions`-style layout) — already mirrored here, just align the FC row to `28%` to match Starting 5 (currently `30%`).
- Replace `TOTWCard`'s body with the same cinematic block used in `PlayerCard` court variant:
  - Team-logo watermark behind the photo (`absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-15`, `w-28 h-28`).
  - Round photo `w-28 h-28 md:w-36 md:h-36 rounded-full object-cover shadow-2xl`, hover `scale-110`.
  - Name `text-sm md:text-base font-heading font-bold text-white drop-shadow-lg` shortened via `formatShortName`.
  - FC/BC badge + salary pill in the same flex row as PlayerCard.
  - Add the GW FP line below ("76 FP (2G)") in `text-emerald-400` to preserve the Team-of-the-Week-specific info.
  - Wishlist heart stays at top-right corner (z-20).
- Container card: drop the `bg-card/95 border-t-2 rounded-lg overflow-hidden` chrome and use the same transparent `flex flex-col items-center group cursor-pointer` wrapper as PlayerCard so the watermark sits correctly behind the photo.
- Modal stays `max-w-4xl` with `aspect-ratio: 16/9` court background; tile width remains `w-[22%]`, positions `top: 28% / 72%` with the same horizontal layout (`20%/50%/80%` for 3, `33%/67%` for 2).

This makes the TOTW players visually identical to the My Roster Starting 5 (no card box, large unclipped photo, watermark behind, name + FC/BC + salary + FP).

### 3. `/schedule` — Top Players (Players of the Day) card redesign
File: `src/components/TopPlayersStrip.tsx`

Affects both tabs (Fantasy Points and Value FP/$) and both columns (FC, BC).

Changes inside `renderPlayer`:
- **Remove** the inline team badge + tricode row currently rendered below the name (the `<img>` + `{p.team}` + `·` + `${p.salary}` block). Salary stays — see below.
- **Add a team-logo watermark** centered behind each row:
  - Wrap row body in `relative overflow-hidden` (already has `rounded-xl`).
  - Insert `<img src={getTeamLogo(p.team)} className="pointer-events-none absolute inset-0 m-auto h-14 w-14 object-contain opacity-30 transition-all duration-300 group-hover:scale-125 group-hover:opacity-60" aria-hidden />`.
  - Add `group` to the row's class list so the watermark scales/brightens on hover (matches the Injury Report row pattern already shipped).
- **Stacking**: every existing inline element (FC/BC badge, avatar, name, FP/value) gets `relative z-10` so they sit above the watermark.
- **Restructure the text column** (where team+salary used to live):
  - Keep just `<span class="text-sm font-heading font-bold truncate">{p.name}</span>` on the first line.
  - Second line becomes a single small row with the tricode + salary, both styled to remain readable on hover:
    - Default: `text-[10px] text-muted-foreground` (unchanged off-hover so existing look is preserved on cards without hover).
    - On hover: `group-hover:text-[hsl(var(--nba-yellow))] group-hover:font-semibold` so when the watermark brightens and the row background shifts, both the tricode and `$salary` switch to bold yellow and remain legible.
  - Drop the small `<img>` next to the tricode (the badge is now the watermark).

Result: each row has a vivid team-logo watermark centered behind it, no duplicate small team badge, and the tricode + salary become bold yellow on hover so they remain readable against the highlighted background.

### Files touched
- `src/components/InjuryReportModal.tsx` — add status chip row + filter
- `src/components/TeamOfTheWeekModal.tsx` — replace `TOTWCard` with cinematic Starting-5 styling
- `src/components/TopPlayersStrip.tsx` — remove inline team badge, add watermark + hover-yellow text

### Verification
- Open AI Coach → Injuries → Scan Injuries: a chip row "All · Out · Day-To-Day · Questionable · Probable" appears with live counts; clicking each narrows the list; combining with My Roster only and team dropdown still works.
- `/schedule` → click the medal → Team of the Week modal: 5 players are laid out on the court using the same cinematic style as My Roster Starting 5 (large unclipped photo, team-logo watermark behind, name + FC/BC + salary), keeping the GW FP line.
- `/schedule` → "Players of the Day" panel (FP and Value tabs, FC and BC columns): no small team badge under the name; a big team logo sits as a watermark centered on each row and surges on hover; the tricode and `$salary` turn bold yellow on hover and stay readable.

