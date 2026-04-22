

## Plan: Picker court fix + remaining Section A–G items

This pass fixes the broken court preview, the badge styling, and ships all deferred sections (Transactions toolbar, Schedule grid card, TOTW pill, Injury report row).

---

### 1 · `PlayerPickerDialog` — landscape court, no flicker, no bleed

**Root causes of "the mess"**
- The court panel is rendered as a sibling FLEX child *outside* the right column, so `flex-1 min-w-0` collapses to 0 width when the player list shows and re-expands when it's empty (`No players found`) → court only shows up when search clears the list.
- `aspect-square` slots inside a vertical column force the court to stretch tall, breaking the landscape feel.
- The picks live in `DraftPicker` only — the dialog has no internal "rebuild on pick" trigger, so when the parent re-renders with new `picks`, the column-width race shows the same flicker.

**Fix**
- Restructure `DialogContent` to a true 2‑column grid: `grid grid-cols-[420px_minmax(0,1fr)] max-w-[960px] h-[min(82vh,44rem)]`. No more flex collapsing.
- Right column always renders the court, even with 0 picks (just shows empty avatar slots). It is the **same landscape court layout used by `RosterCourtView` / `TeamOfTheWeekModal`**: full‑width rounded card with `aspectRatio: 16/9`, court bg, and absolute‑positioned slots via the shared `getRowPositions("28%")` and `getRowPositions("72%")` helpers (extract these into `src/lib/court-layout.ts` and reuse from all three components — no behavioural change to the existing court renders).
- Slot rendering mirrors the Starting‑5 cards: round photo + last‑name caps + `FC/BC` pill + `$X.XM` chip. Empty slots use the shadcn `Avatar` fallback (initials‑less circle on a translucent dark disc).
- `X` remove button stays top‑right of each filled slot (kept from current).
- Header counters above the court: `Picked N/10` · `$X.XM LEFT` (green > 0, red < 0) · `FC N/5` · `BC N/5`. No budget chip in the left header.
- Player list rows: replace `FP: {fp5}` with `FP: {season.fp}` (per‑game season FP, not 5‑game).

### 2 · `PlayerCard` (court variant) — naked badge, no ring, no bg

- Drop the `bg-card ring-2 ring-white shadow-lg` wrapper around the team logo. Render the badge as a plain `<img>` at `w-7 h-7` absolute‑positioned `-top-0.5 -right-0.5`, with only a subtle `drop-shadow-md` for legibility on the court. No background, no ring.

### 3 · `/transactions` — trade dropdown, budget, AI Coach, chips

`src/pages/PlayersPage.tsx`

Add a sticky toolbar row above the table:
1. **Releasing dropdown** (shadcn Popover + Command) sourced from `rosterStarters + rosterBench`. Selecting toggles into `releasing: number[]`. Cap = 2 unless **All‑Star** or **Wildcard** chip is on (cap = 10). Selected players show as removable pills.
2. **Live budget** = `bankRemaining + Σ(releasedSalary) − Σ(addedNotYetCommitted)`. Bold green when positive, bold red when negative.
3. **All‑Star** + **Wildcard** chips (Sparkles + RefreshCw). Toggle raises release cap.
4. **AI Coach** button on the right (Bot icon) opens existing `<AICoachModal>`.
5. Add‑to‑roster `+` is gated by: budget, max 2/team, 5 FC / 5 BC quotas, total ≤ 10, factoring pending releases.
6. **Apply trades** button: `saveRoster(...)` removing released ids and appending the additions; existing `handleAddPlayer` stays for one‑off adds when there are no releases pending.
7. Pagination + table position untouched.

### 4 · `ScheduleList` grid view — center badges, bottom icons, fix clipping

In the `compact: true` branch:
- **Top row**: `[away badge LARGE w-14 h-14] @ [home badge LARGE w-14 h-14]`, centered, with team scores under each badge for finals. Badges get `transition-transform hover:scale-110 drop-shadow-[0_0_18px_hsl(var(--accent)/0.45)]`. Default colours retained (no greyscale).
- **Bottom row**: venue name italic on the left + the action icons strip (Recap, BoxScore, Charts, PbP, NBA, ChevronDown) on the right, all on the same baseline.
- **Border clipping**: drop the `overflow-hidden` from the card wrapper (move it to the `<img>` venue background only via its own wrapper) AND add `p-px` to the grid row container so the top‑row borders aren't shaved by the parent.

### 5 · `TeamOfTheWeekModal` — soft‑pill `FP (G)`

Replace the bare emerald text with a single soft container under the FC/BC + $X.XM row:
```
<div class="mt-1 mx-auto rounded-xl px-3 py-1 bg-emerald-500/85 text-black text-xs font-heading font-bold shadow-md"
     style={{ width: "calc(2*5rem + 0.375rem)" }}>
  78 FP <span class="opacity-70">(2G)</span>
</div>
```
Width matches the FC + $ pill row above. Background = the per‑slot accent (emerald for the team‑of‑the‑week green; falls back to `accent` if needed). Dark font for legibility.

### 6 · `InjuryReportModal` — reorder row + photo as watermark

Row layout becomes: `[STATUS pill] [team badge] [name + pos] ····· [injury type] [date]`.

- Move `team logo` to immediately after the status pill (currently far‑right).
- Drop the inline photo `<img>` from the row.
- Add the photo as an absolutely‑positioned watermark inside the `<li>` (which already has `relative`):
```
<img src={rec.photo} class="pointer-events-none absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 h-12 w-12 object-cover rounded-full opacity-[0.06] group-hover:opacity-[0.18] group-hover:scale-110 transition-all" />
```
- Injury type stays as the flex‑grow truncating cell, then date at the far right.

### Files

**Edit**
- `src/components/PlayerPickerDialog.tsx` — 2‑col grid, landscape court, shared layout helper, FP from season, no flicker.
- `src/components/PlayerCard.tsx` — strip badge background/ring.
- `src/components/RosterCourtView.tsx` + `src/components/TeamOfTheWeekModal.tsx` — switch to shared `getRowPositions` helper (no visual change).
- `src/pages/PlayersPage.tsx` — toolbar with release dropdown, budget, chips, AI Coach button, apply‑trades flow.
- `src/components/ScheduleList.tsx` — grid card: centered badges with glow, bottom action strip, border clipping fix.
- `src/components/TeamOfTheWeekModal.tsx` — soft‑pill `FP (G)`.
- `src/components/InjuryReportModal.tsx` — row reorder + watermark photo.

**Create**
- `src/lib/court-layout.ts` — shared `getRowPositions(count, topPct)` helper (extracted from existing duplicates).

### Acceptance

- Manual draft: opening the picker shows a landscape court immediately, with empty slots in 5 FC top row + 5 BC bottom row (matching Starting 5 / TOTW). Picking a player updates instantly with no flicker; the court stays visible whether the search list is empty or full.
- Court PlayerCard shows just the team badge (no white ring, no card background).
- `/transactions` toolbar exposes Trade dropdown, live budget chip, All‑Star + Wildcard chips, AI Coach button. The players table size and pagination are unchanged.
- Schedule grid cards: large centered team badges with hover glow; venue + action icons share the bottom row; no clipped borders on top‑row cards.
- TOTW: each card's `FP (G)` line is a single soft pill matching the row width above.
- Injury report rows: badge sits left next to the status pill; photo appears only as a centered watermark with the existing surge‑on‑hover style.

