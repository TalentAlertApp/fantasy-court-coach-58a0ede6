

## Plan: Injury Report Modal — roster filter, click-to-open, caching, equal tabs, scroll, restyled row

All edits land in `src/components/InjuryReportModal.tsx`.

### 1. "My Roster only" toggle
- Add a small `Switch` (shadcn) in the header row, left of the "Updated X min ago" timestamp, labelled `My Roster only`.
- Pull active roster via `useRosterQuery()` and build a `Set<number>` of `player_id`s.
- New state `myRosterOnly: boolean` (default `false`).
- Apply filter inside the existing `view`-derived list:
  - `const filtered = myRosterOnly ? items.filter(r => r.player_id != null && rosterIds.has(r.player_id)) : items;`
- Counts shown on the "ALL" pill and the team dropdown badges also reflect the filter when toggled on.
- Empty state when filter yields zero rows: "No injuries on your roster" + check icon.

### 2. Click row → open existing PlayerModal
- Import `PlayerModal` from `@/components/PlayerModal`.
- Add state `const [openPlayerId, setOpenPlayerId] = useState<number | null>(null)`.
- In `InjuryRow`, when `rec.on_roster && rec.player_id`, the row becomes a `<button>`-like clickable element (cursor-pointer, hover bg) calling `onSelect(rec.player_id)`.
- Off-roster rows stay non-clickable (no `player_id` to open).
- Render `<PlayerModal playerId={openPlayerId} open={openPlayerId !== null} onOpenChange={(o) => !o && setOpenPlayerId(null)} />` at the bottom of the InjuryReportModal tree (nested Dialogs are fine — already done in PlayerModal itself for boxscore).

### 3. Cache payload in localStorage for 30 minutes
- Storage key: `nbaf:injury-report:v1`. Shape: `{ savedAt: number, payload: InjuryPayload }`.
- On modal open:
  - Read cache. If `Date.now() - savedAt < 30 * 60_000`, hydrate `payload` synchronously and skip the network call (instant render).
  - Otherwise call `nba-injury-report` and on success write fresh cache.
- `Refresh` button always bypasses cache (force fetch + overwrite cache).
- "Updated X min ago" continues to read from `payload.generated_at` so the cached label stays accurate.

### 4. Equal-width "ALL" and team-select tabs
- Wrap both controls in a centered grid:
  - `<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 max-w-xl mx-auto w-full">`
  - Left cell: `ALL` button with `w-full justify-center` (so it stretches to match).
  - Middle cell: `|` divider.
  - Right cell: `<SelectTrigger className="w-full ...">`.
- This forces the ALL pill to be exactly as wide as the team Select trigger (both = 1fr).
- ALL pill keeps its existing red count badge inside.

### 5. Vertical scroll inside the list
- Current body wrapper already uses `flex-1 min-h-0 overflow-y-auto`, but the `Dialog` height on desktop is `sm:h-auto sm:max-h-[85vh]`. Confirm and tighten:
  - Outer `DialogContent` already constrains height; set the list container explicitly to `flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1` so the inner `<ul>` scrolls smoothly while header (title + ALL/Select bar) stays sticky.
  - Header bar gets `sticky top-0 z-20 bg-background/95 backdrop-blur-sm`.
- Mobile (`w-screen h-screen`) already provides full height; same flex layout works.

### 6. Restyled player row
New right-side ordering inside `InjuryRow`:
```
[OUT] [photo] Name [POS] · Injury · ……… [DATE]  [TEAM BADGE]   [ⓘ?]
```
- Move the team-logo watermark out and replace it with a real, foreground team badge on the far right (`h-7 w-7 object-contain shrink-0`). Keep the hover surge: `transition-transform duration-200 group-hover:scale-110` (no more absolute watermark).
- Place the **return date** immediately to the left of the badge.
- Date colouring rule (replaces current `season-end red / TBD muted`):
  - Compute days-from-today using the parsed `estimated_return` date (when it parses).
  - `<= 30 days` → `text-yellow-400 font-bold` (bold yellow).
  - `> 30 days` → `text-red-500 font-bold` (bold red).
  - "Season-ending" / "Next Season" → bold red (treated as long).
  - "TBD" / unparseable → `text-muted-foreground` (no bold).
- Keep `font-mono text-[11px]` for the date.
- Layout: change row to `flex items-center gap-2` with the injury text getting `flex-1 min-w-0 truncate`, then date, then badge, then info icon. Drop `ml-auto` from date (now naturally pushed by flex-1 on the injury text).

### Verification
- Toggle `My Roster only` → list shrinks to roster injuries; ALL count and team badges update accordingly; empty state reads "No injuries on your roster".
- Click a roster player row → existing PlayerModal opens with the right player; closing returns to the Injury modal.
- Reopen the modal within 30 min → list appears instantly with no skeleton; "Updated X min ago" still reads off cached `generated_at`. After 30 min or on Refresh, a fresh fetch runs.
- ALL pill and team Select trigger have identical width, both centered.
- Long lists scroll vertically; header (title + ALL/Select) stays sticky.
- Each row shows the team badge on the far right; the date sits just left of it, bold yellow when ≤30 days away, bold red when >30 days or season-ending; TBD stays muted.

