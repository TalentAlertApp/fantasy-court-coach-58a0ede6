

## /transactions polish — drawer behavior, ADD-mode commit fix, header re-org, fixed table header

Seven precise fixes, no scope creep.

### 1. Mobile drawer behavior (RosterPane Sheet)

Already exists for `< 1280px`. Two refinements:
- The header button "Roster N/10" stays inside the header row (already done).
- `onRosterToggleOut` already calls `setRosterSheetOpen(false)` when narrow — KEEP. Confirmed working; document the behavior in a code comment so future edits don't regress it.
- Add `aria-label="Open my roster"` to the trigger button for a11y.

### 2. Trade Workbench — full width + cleanup + ADD commit fix

**a) Full width**: workbench moves OUT of the center column, BACK above the 3-column flex (header → workbench → 3 cols). Keeps it spanning the page. Roster pane / table / filters all start aligned at the same top edge below it.

**b) Remove the OUT/IN top row entirely** (the `OUT [Optional] → IN [Click + on a player]` row). Chips for staged players move to live INLINE with the metric pills + status row. New compact two-row workbench:

```text
╭─ TRADE WORKBENCH ──────────────────────────────────────────────╮
│ OUT: [Doncic ✕]   IN: [Curry ✕]                                │  ← only when chips exist
│ Bank $55.6  Freed +$0  Spent −$0  Available $55.6  GW25 0/2    │
│ ✅ Pick a player to release    [Reset] [Confirm Add] [Report]  │
╰────────────────────────────────────────────────────────────────╯
```

When NO chips are staged, the entire chip row collapses (no empty placeholders). Banner "Roster 9/10 — you can ADD a player directly" stays as-is (top of card).

**c) ADD mode commit bug**: today, clicking [+] on a row stages the player to IN, but to make it permanent the user must click the "Report" button → then "Confirm" inside the report. That's confusing for ADD mode where there's no swap to compare. Fix:

- When `addMode && outZone.length === 0 && inZone.length > 0`, the workbench shows a primary **`[Confirm Add]`** button (replaces the Report button). One click → calls `handleCommit()` directly. No report, no extra step.
- For SWAP mode, keep the existing `[Report]` flow unchanged.
- Toast on success: "Curry added to your bench" + roster query invalidation (already wired).
- Backend `transactions-commit` already supports ADD mode (verified: lines 96-103, 232-260). No edge function changes needed.

**d) All-Star and Wildcard buttons**: REMOVE from the workbench. ADD them to the page header row, RIGHT after `[AI Coach]`:

```text
[Schedule] [AI Coach] [✨ All-Star] [🔄 Wildcard]    491 available · 237 eligible
```

Same toggle props (`chipAllStar`, `chipWildcard`); same active styling. Tooltip text preserved.

### 3. Roster pane redesign

**a) Drop section bars**: Remove "STARTING 5" and "BENCH" headers. Render ALL 10 players as one continuous list. Sort: all FC first (sub-sorted by salary DESC), then all BC (sub-sorted by salary DESC). Inside `RosterPane.tsx`, replace the two-section render with a single sorted list:

```ts
const allPlayers = [...starters, ...bench];
const sorted = allPlayers.sort((a, b) => {
  if (a.fc_bc !== b.fc_bc) return a.fc_bc === "FC" ? -1 : 1;
  return b.salary - a.salary;
});
```

**b) Move `[−]` to the FAR LEFT** of each row. New row order:

`[−]   Avatar   FC/BC badge   Name   TeamLogo   $Salary`

The `[−]` button keeps its destructive hover style and the OUT-zone ring on the row stays.

### 4. Right-side table — fixed header, scrollable body

Currently `TableHeader` uses `sticky top-0 z-10 bg-background` inside an `overflow-y-auto` div. The header IS sticky but visually drifts because the wrapper relies on the table's own intrinsic scrolling. Two fixes:

- Wrap the table in a flex column container: header in a `shrink-0 border-b` div, body in `flex-1 overflow-y-auto`. Keep using `<Table>` semantics by splitting into TWO tables: header table (no body) above + body table (no thead) below, both sharing a fixed `table-layout: fixed` and identical column widths via `<colgroup>`.
- Alternative (simpler, preferred): Keep one `<Table>` but wrap the ENTIRE table in a `<div class="flex-1 min-h-0 overflow-y-auto">` and set `<TableHeader class="sticky top-0 z-20 bg-background shadow-[inset_0_-1px_0_hsl(var(--border))]">`. Add the inset shadow so the header has a visible bottom border when content scrolls under it. Also add `bg-background` to each `<TableHead>` cell so cell backgrounds are opaque (currently the parent `<tr>` has `bg-background` but `<th>` cells inherit transparency in some browsers, causing scroll-through bleed).

Going with option 2 — minimal change, no double-table sync issues.

### Files touched

**Modified**
- `src/pages/PlayersPage.tsx`
  - Move `<TradeWorkbench />` OUT of the center column → render directly under the header row, full width.
  - Header row: add `[All-Star]` + `[Wildcard]` buttons after `[AI Coach]` (move from workbench).
  - Center column: remove the `<TradeWorkbench />` wrapper; just `<TradeReport />` (when open) + scrollable table + pagination.
  - Table header: add `bg-background` + inset bottom shadow on `<TableHead>` cells (or via `TableHeader` child selector).
  - Update `<TradeWorkbench>` props: drop `chipAllStar/chipWildcard/onToggleAllStar/onToggleWildcard`; add `onCommitAdd` callback and a `canCommitAdd` boolean.

- `src/components/transactions/TradeWorkbench.tsx`
  - Remove the OUT/IN zones row (chips collapse into a single inline strip when present).
  - Remove All-Star + Wildcard buttons.
  - Add ADD-mode primary button: `[Confirm Add]` (replaces `[Report]` when `addMode && outZone.length === 0 && inZone.length > 0`).
  - Keep `[Reset]` + `[Report]` for SWAP mode.

- `src/components/transactions/RosterPane.tsx`
  - Drop the two `<div>` sections + `section-bar` headers.
  - Merge `starters` + `bench` into single sorted list (FC desc by salary, then BC desc by salary).
  - Re-order each row: `[−]` first, then Avatar, FC/BC badge, Name, TeamLogo, $Salary.

**No changes**: `useMediaQuery`, `trade-eligibility`, `useTradeValidation`, `transactions-commit` edge function, FiltersPanel.

### Why this works

- **Workbench full-width** → matches the visual weight of the action; chips no longer compete with empty placeholders.
- **All-Star/Wildcard in header** → they're page-level chips, not per-trade; they belong with Schedule/AI Coach as session controls.
- **Confirm Add** → one-click ADD path makes the "9/10" message actionable; backend already supports it.
- **FC-grouped roster pane** → matches the FC/5 + BC/5 mental model; no more "starting vs bench" decision (those slots can be reshuffled on the Roster page).
- **Fixed table header** → cells stay readable as the user scrolls through 491 players.

### Out of scope

- Drag & drop between roster pane and table.
- ADD-mode mini-report (skip; ADD doesn't need a comparison report — it's a pure add).
- Filters panel responsive drawer.
- Roster pane sub-grouping by starter/bench (intentionally dropped per request).

