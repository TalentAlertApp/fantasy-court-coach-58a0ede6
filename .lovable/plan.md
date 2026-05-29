All changes are presentation-only — no data, hooks, or business logic touched.

## 1. Sidebar divider — delete it
In `src/components/layout/AppLayout.tsx` (line ~204), remove the hairline element above Player Search entirely:
```text
<div className="mx-3 my-1 h-px bg-sidebar-border/40" />
```
The expanded branch then renders just the `px-3 py-2` Search box wrapper. The collapsed branch (separate, uses `.sidebar-divider`) is untouched.

## 2. /scoring — add a top header
In `src/pages/ScoringPage.tsx`, add a `PageHeaderCaption` directly above the existing 3-column grid (line ~134), matching the /transactions caption exactly (same component, font, size, position):
```text
<PageHeaderCaption className="mb-2">Scoring · League & Team</PageHeaderCaption>
```
Add `PageHeaderCaption` to the existing import from `@/components/layout/PageHeaderTabs`. The current league selector / centered tabs / team selector row stays as-is, just below the new caption.

## 3. /transactions — soften the bar below the 4 buttons
The "bar" is the `TradeWorkbench` outer container in `src/components/transactions/TradeWorkbench.tsx` (line 158), currently a hard card:
```text
rounded-2xl border border-border bg-card p-4 space-y-3
```
Replace it with the soft, quiet style used by the /advanced tab bar (bottom border only, faint translucent fill, subtle blur):
```text
border-b border-border bg-card/30 backdrop-blur-sm rounded-t-lg px-4 py-3 space-y-3
```
Internal rows/chips are unchanged.

## 4. /teams — center the 3 tabs + add a context word on the far left
In `src/pages/TeamsPage.tsx` the tabs use `UnderlineTabsBarManual` with only a `right` slot (the sort icon / standings filters), so the bar isn't truly centered.

- Extend `UnderlineTabsBarManual` in `src/components/layout/PageHeaderTabs.tsx` with an optional `left` slot. When `left` and/or `right` are present, lay the row out so the tab group is **optically centered** regardless of side widths: render `left` and `right` as absolutely-positioned clusters (`absolute left-0 / right-0`) over a `relative` row, with the centered tab grid in the middle. Existing callers that pass only `right` keep working.
- In TeamsPage, pass a `left` node: a small, context-sensitive **count word** styled like a muted caption (`text-[10px] font-heading uppercase tracking-wider text-muted-foreground`), changing per active tab:
  - Teams tab → e.g. `30 Teams`
  - Standings tab → e.g. `30 Teams`
  - Stats tab → e.g. `121 Players`
  (rendered as the existing list length so it stays accurate). The far-right sort icon / filters stay exactly intact.

## 5. /leagues — soften the filter+search+dropdown bars
In `src/pages/LeaguesPage.tsx` there are two identical filter bars (Mine tab line ~539 and Discover tab line ~767), both:
```text
flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 p-3
```
Replace each with the same soft /advanced style as #3 (keeping enough padding for the inputs):
```text
flex flex-wrap items-center gap-2 border-b border-border bg-card/30 backdrop-blur-sm rounded-t-lg px-3 py-2
```
Filters, search input, and dropdown controls inside are unchanged.

## 6. /advanced — lift the header to the /transactions position
In `src/pages/AdvancedPage.tsx` the page wrapper (line ~897) adds extra top padding on top of the global `.page-scroll` (`py-5`):
```text
max-w-7xl mx-auto py-6 px-4 space-y-4
```
Drop the vertical padding so the caption sits at the same height as the /transactions caption (which relies only on `.page-scroll`):
```text
max-w-7xl mx-auto px-4 space-y-4
```
Everything below moves up with it since it's all inside this wrapper.

### Technical notes
- New shared capability: `UnderlineTabsBarManual` gains an optional `left?: ReactNode` prop and absolute-positioned side clusters for true centering; default behavior for existing `right`-only callers is preserved.
- Reuse existing tokens/classes (`bg-card/30`, `backdrop-blur-sm`, `border-border`, `rounded-t-lg`) so the softened bars match /advanced precisely.
- The /teams left word is derived from already-loaded counts (team list length / players length) — no new fetches.
