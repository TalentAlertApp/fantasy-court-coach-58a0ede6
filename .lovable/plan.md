

## Plan: Day-tab styling, header reordering, week 25 clip, and AI Coach dropdown visibility

### 1. `/schedule` — day tabs: add themed border + rounded format on every tab
File: `src/pages/SchedulePage.tsx` (day-navigator buttons, lines ~159-188)

- Wrap each day `<button>` in a small `p-0.5` cell so the visible button has consistent rounding, OR apply the styling directly: every tab becomes a rounded pill with a 1px border in `border-[hsl(var(--nba-navy))]` (light) / `dark:border-[hsl(var(--nba-yellow))]` (dark).
- Replace the current "border-r divider" approach with a per-tab outlined pill:
  - Drop `border-r border-border/60 last:border-r-0`.
  - Wrap the button row with `gap-1` so pills don't touch.
  - Base classes on every button: `rounded-xl border border-[hsl(var(--nba-navy))] dark:border-[hsl(var(--nba-yellow))]/60`.
  - Selected state keeps `bg-primary text-primary-foreground shadow-md`.
  - Unselected hover keeps `hover:bg-muted/50`.
- Result: every day tab now has the same rounded pill shape and a visible navy (light) / yellow (dark) outline, matching the active tab's silhouette — exactly like the GW pills above.

### 2. `/schedule` — reorder header icon row + add bullet separators
File: `src/pages/SchedulePage.tsx` (lines ~210-259)

Current order: `Date · Day # · Deadline · [Shield] [Grid3X3] [List/Grid toggle]`.

New order: `Date · Day # · Deadline · [List/Grid toggle] · [Shield] · [Grid3X3]`.

- Move the `<div className="inline-flex … rounded-xl border …">` (List/Grid toggle) to sit immediately after the `Deadline` block (before the existing `·` separator).
- Insert a small bullet separator (`<span className="text-muted-foreground/40">·</span>` — same one already used between Day # and Deadline) between:
  - List/Grid toggle ↔ Shield (Injury Report)
  - Shield ↔ Grid3X3 (Advanced Schedule Grid)
- Final markup order in the LEFT cluster:
  ```
  Date · Day # · TODAY badge · · Deadline · [List/Grid toggle] · [Shield] · [Grid3X3]
  ```

### 3. `/schedule` — fix week 25 right-edge clip
File: `src/pages/SchedulePage.tsx` (week strip, lines ~108-132)

The week strip uses `overflow-x-auto` with `gap-0.5`, and the active pill's `shadow-md` + outline gets clipped on the rightmost pill (week 25). Fix:

- Add right-side breathing room to the scroll container: change the strip's parent `px-3` to `px-3 pr-4` (or add `pr-2` to the inner `flex` div) so the last pill's outline/shadow renders fully.
- Equivalently, add an invisible spacer `<span className="shrink-0 w-1" aria-hidden />` after the `.map(...)` so the scroll area extends just past the last pill.
- Either fix is sufficient; we'll use the spacer approach since it doesn't change the navy band's visual padding.

### 4. AI Coach → Explain — fix invisible autocomplete dropdown
File: `src/components/AICoachModal.tsx` (Explain tab, dropdown at lines ~358-419)

The dropdown is currently rendered as `<div className="absolute … z-50">` inside `TabsContent`, which is itself inside the modal's scroll container `<div className="flex-1 min-h-0 overflow-y-auto …">` (line 228). `overflow-y-auto` creates a clipping context that hides the absolutely-positioned dropdown — that's why the user sees nothing.

Fix (no behaviour change, only stacking):
- Replace the `absolute` dropdown with a Radix `Popover` so it renders into a portal at the document root (no parent-clipping):
  - Import `Popover, PopoverTrigger, PopoverContent, PopoverAnchor` from `@/components/ui/popover`.
  - Wrap the input + Explain button row in a `<Popover open={showDropdown && explainMatches.length > 0} onOpenChange={setShowDropdown}>` with the input as the `PopoverAnchor` (so width matches the input).
  - Move the dropdown markup into `<PopoverContent>` with `align="start"`, `side="bottom"`, `sideOffset={4}`, `className="p-0 rounded-xl w-[var(--radix-popover-trigger-width)] max-h-[260px] overflow-y-auto z-[100]"` and `onOpenAutoFocus={(e) => e.preventDefault()}` so the input keeps focus while typing.
  - Remove the manual `dropdownRef` + outside-click listener — Popover handles outside-click closing natively. Keep the `useEffect` that opens the popover when `explainMatches.length > 0`.
- This guarantees the dropdown sits in a portal above all dialog content and is no longer clipped by the modal's `overflow-y-auto` scroll container.

### Files touched
- `src/pages/SchedulePage.tsx` — restyle day tabs as outlined pills (navy / yellow border per theme); reorder the header icon row to `[List/Grid] · [Shield] · [Grid3X3]` after the Deadline block; add a right-edge spacer in the GW strip so week 25 isn't clipped.
- `src/components/AICoachModal.tsx` — convert the Explain autocomplete from a clipped `absolute` div into a Radix `Popover` (portal), keeping all selection/match logic identical.

### Verification
- `/schedule`: every day tab now shows a rounded pill outline in navy (light theme) / yellow (dark theme); active tab still rendered as a filled primary pill.
- `/schedule` header: after the Deadline, the icon order is List/Grid toggle → bullet → Shield → bullet → Grid3X3, with the same `·` separator already used between Day # and Deadline.
- `/schedule`: the GW strip can scroll one pixel further so week 25 (rightmost) shows its full outline/shadow even when not selected.
- `/` → AI Coach → Explain → type "Pau": the autocomplete dropdown now appears directly under the search input with player rows; clicking a row selects the player; clicking outside closes it.

