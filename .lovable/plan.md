

## Player Modal — fix all 4 tabs to fill modal height & top-align content

**Root cause** (visible in image-270 Schedule and image-271 AI Explain): the `Tabs` container is `flex-1 min-h-0 flex flex-col`, but Radix `TabsContent` panels render with `mt-2` from the default `tabs.tsx` styles and don't reliably stretch as a flex child inside the panel area, leaving content collapsed near the bottom of the available space. STATS works visually because its content is short; SCHEDULE/AI sit at the bottom; HISTORY appears short because of the wrapper.

Single file edit: **`src/components/PlayerModal.tsx`**.

### a) SCHEDULE tab (lines 332–375)

- Add `data-[state=active]:flex` and `mt-3` (replacing default `mt-2`) so the panel becomes a true flex column when active.
- Keep header `shrink-0` at the top.
- Wrap the table in a flex-1 ScrollArea so the rows render directly under the "UPCOMING GAMES" header and the panel stretches all the way to the modal bottom.
- Remove the empty-state condition's effect on layout (still show "No upcoming games" but keep the column structure so spacing is consistent).

### b) AI EXPLAIN tab (lines 377–418)

- Same `data-[state=active]:flex` + `flex flex-col gap-3` fix.
- "ASK AI" button stays as the first child with `shrink-0` → pinned to the top of the panel.
- Response container becomes `flex-1 min-h-0 overflow-y-auto` → fills from just below the button down to the modal bottom.
- When idle (no `aiResult`, not loading), the response container still occupies the remaining height (empty), so the button stays anchored top.

### c) STATS tab (lines 204–223)

- Remove the implicit "container" feel: drop the `mt-2` default, let the 2-column grid render flush against the tabs strip.
- Keep `flex-1 min-h-0 overflow-y-auto` so the panel itself fills the available height (the grid sits at the top, blank space below — matches image-268's layout but with the panel claiming the full height instead of collapsing).
- No visible wrapper card — already none in code; the perceived "container" in the screenshot was the watermark + collapsed panel. Forcing the panel to full height removes the boxed look.

### d) HISTORY tab (lines 226–330)

- Apply the same `data-[state=active]:flex flex-col` treatment.
- "THIS SEASON" label stays `shrink-0` at top.
- ScrollArea around the table becomes `flex-1 min-h-0` so the table scrolls inside the panel and the panel reaches the modal bottom (no short table look).

### Concrete className change applied to all 4 panels

Replace each `<TabsContent value="…" className="flex-1 min-h-0 …">` with:

```
<TabsContent
  value="…"
  className="flex-1 min-h-0 mt-3 data-[state=active]:flex data-[state=active]:flex-col …"
>
```

(`data-[state=active]:flex` overrides the default `display: block` Radix gives the active panel, guaranteeing the inner `flex-1` children stretch.)

Also bump the parent `Tabs` element's `flex-1 min-h-0 flex flex-col` to also include `mt-1` removed and add a wrapping `<div className="flex-1 min-h-0 flex flex-col">` only if needed — single-pass verification will confirm `Tabs = TabsPrimitive.Root` accepts className correctly (it does).

### Files touched
- `src/components/PlayerModal.tsx` — 4 small className tweaks + 1 ScrollArea wrapper around the History/Schedule tables to ensure they own scrolling.

### Out of scope
- No changes to `src/components/ui/tabs.tsx` (would affect every Tabs usage app-wide).
- No changes to BreakdownCard or header.

