

## /transactions UI/UX overhaul — alignment, drawer, smart [+], filters consolidation

Six surgical fixes to make the page coherent, responsive, and clearly explain why each [+] is enabled or disabled.

### 1. Top-row alignment (header + workbench together)

Restructure the page header so left and right columns align at the top:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Transactions  ░░ 491 available  [Schedule] [AI Coach]              │  ← compact header row
├──────────┬───────────────────────────────────────┬──────────────────┤
│ MY ROSTER│  TRADE WORKBENCH (compact, redesigned)│  FILTERS         │
│ (left)   │  ───────────────────────────────────  │  [PG | TOTALS]   │
│ Starter5 │  AVAILABLE PLAYERS table              │  Position FC/BC  │
│ Bench    │                                       │  Team            │
│          │                                       │  Search          │
│          │                                       │  Max salary      │
└──────────┴───────────────────────────────────────┴──────────────────┘
```

- The 3 columns share the SAME top edge — no card-above-everything offset.
- The workbench moves INSIDE the center column (above the table), so it no longer spans full width and no longer pushes the left/right columns down.
- "PER GAME / TOTALS" toggle moves out of the header into the FiltersPanel (compact `h-7` toggle at the very top of the filters card, label "VIEW").

### 2. Trade Workbench redesign — single clean card, no clutter

Replace the cramped 2-row dense layout with a vertical, breathable card:

```text
╭─ TRADE WORKBENCH ─────────────────────────────────╮
│  OUT  ●●     →     IN  ○○                         │  big chips, generous gap
│  [Doncic ✕]  [empty]   →   [empty] [empty]        │
│                                                   │
│  Bank $55.6  Freed +$0  Spent −$0  Available $55.6│  one neat metric row
│  ✅ Pick a player to release · GW3 0/2 trades     │  one status line
│                                                   │
│  [All-Star] [Wildcard]    [Reset] [Generate Report]│  actions row
╰───────────────────────────────────────────────────╯
```

Concrete edits to `TradeWorkbench.tsx`:
- Outer card: `rounded-2xl border bg-card p-4 space-y-3` (was `px-3 py-2.5 space-y-2`).
- Row 1 (zones): `gap-3` between OUT/IN, removed `flex-wrap` for chips themselves so empty slots stay inline; chips get `h-10 px-2.5` with proper letter-spacing.
- Row 2 (metrics): single `flex gap-2` line — Bank, Freed, Spent, Available — pill-shaped (`rounded-full h-7 px-3`), neutral border by default, color only the value text.
- Row 3 (status): validity pill + GW counter on the LEFT; All-Star/Wildcard/Reset/Generate Report cluster on the RIGHT. Removes the redundant "GW transfer cap reached" banner (info already lives in the GW pill via tooltip + destructive color).
- Remove the duplicated `outZone.length`/`inZone.length` display in slot labels — chip count is visible.

### 3. Smart [+] when roster has < 10 players (Add mode vs Trade mode)

This is a product change, not a bug. Today `stageIn` blocks [+] until user picks an OUT. New rule:

- **If roster.length < 10** → [+] becomes a "direct ADD" action. No OUT required. Validates against bank + FC/BC + team cap + GW count. On click, opens a small inline confirmation strip ("Add Curry for $14M? [Confirm] [Cancel]") then calls a new `commitAdd()` path.
- **If roster.length === 10** → current trade-machine behavior (need OUT first). Tooltip text adjusted accordingly.

Backend: `transactions-commit` already accepts `outs:[]` arrays — pass `outs: []` and `ins: [id]` for adds. Server-side validation must allow the empty-OUT case only when roster < 10. One small branch in the edge function.

UI surface: a subtle banner above the workbench when roster < 10:
> "Roster has 9/10 players — you can ADD a player without releasing one. Use [+] on any row."

### 4. Per-row eligibility indicators (right table)

Add a small status dot/icon column so users see at a glance why each [+] is allowed or blocked. The column is the leftmost cell, replacing the bare [+] button with a button + dot stack:

```text
[+] ✅                          ← eligible
[+] 🚫 (disabled)               ← blocked
   tooltip: "Over budget by $2.1M"
```

Replace the current `addTitle` string with a structured eligibility object computed per row:

```ts
type Eligibility = {
  ok: boolean;
  reason?: "no_out" | "in_full" | "team_cap" | "over_budget" | "fc_bc" | "gw_cap" | "in_zone";
  message: string;     // tooltip text
  shortLabel: string;  // tiny chip "TEAM 2/2", "OVER $2.1M", etc.
};
```

Each row renders:
- The [+] button (current style).
- A tiny pill next to it: green dot ✅ when ok, amber dot ⚠ + 2-word reason when blocked.
- Hovering the pill shows the full sentence.

Reasons covered:
- `no_out` — "Roster full — pick a player to release"
- `in_full` — "IN zone full — only N replacement(s)"
- `team_cap` — "Max 2 from {TRI} (would be 3)"
- `over_budget` — "Over budget by ${X}M (have ${Y}M)"
- `fc_bc` — "Would leave {n}FC / {m}BC (need 5/5)" — NEW: now also runs the FC/BC simulation per row
- `gw_cap` — "GW{N} cap reached — resets {date}"
- `in_zone` — already staged (green pill, click to remove)

The same per-row eligibility logic also drives a tiny eligibility summary at the top of the table: "247 available · 198 eligible for current trade".

### 5. Roster pane refinements

Two fixes inside `RosterPane.tsx`:
- **Move team badge after name**: row order becomes `Avatar — FC/BC badge — Name — TeamLogo — $Salary — [−]`. Currently logo is between avatar and FC/BC, reading "Avatar Logo FC Name $". New order reads "Avatar FC Name Logo $" which is what was asked (logo right after name).
- Avatar size up to `h-8` for parity with center-table avatars; row vertical padding `py-1.5` so left and center rows feel related.

### 6. Responsive collapse — drawer for narrow widths

At viewports < `1280px` (Tailwind `xl`), the left roster pane collapses into a Sheet/Drawer behind a sticky button:

```text
< 1280px:
┌─────────────────────────────────────────────────────────────────┐
│  Transactions  [☰ Roster] [Schedule] [AI Coach]   491 available │
├─────────────────────────────────────────────────────────────────┤
│  TRADE WORKBENCH                                                │
│  AVAILABLE PLAYERS table                                        │
└─────────────────────────────────────────────────────────────────┘
   (Filters becomes a drawer too at < 1024px — already partially handled)
```

Implementation:
- Wrap `<RosterPane />` in a `useMediaQuery("(min-width: 1280px)")` check.
- When false, render a `[☰ My Roster (n/10)]` button in the header that opens a left-side `Sheet` (already in shadcn) containing the same `<RosterPane />` content.
- Sheet auto-closes after a [−] click so user can immediately pick a replacement.
- Filters: similar `(min-width: 1024px)` collapse — at narrow widths, render a `[Filters]` button → right Sheet. (Optional second wave; primary scope is the roster pane.)

### Files touched

**Modified**
- `src/pages/PlayersPage.tsx`
  - Restructure: 3-column flex with shared top alignment; workbench moves into center column above the table.
  - Move PER GAME/TOTALS toggle out of header — pass `perfMode` + `onPerfModeChange` to FiltersPanel instead.
  - Add `useMediaQuery` (or `useIsMobile`-style hook extended to xl breakpoint) → render either inline `RosterPane` or `Sheet`-wrapped one.
  - Replace per-row `addTitle` string with structured `getEligibility(player)` returning the new shape.
  - Add `mode` derivation: `addMode = rosterIdList.length < 10`. Adjust `stageIn` to call new `commitAdd()` path when `addMode && outZone.length === 0`.
  - Render eligibility pill next to each [+].

- `src/components/transactions/TradeWorkbench.tsx`
  - Vertical 3-row redesign (zones / metrics / status+actions).
  - Drop the duplicate "cap reached" banner.
  - Bigger chip avatars (`h-8`) and more breathing room.

- `src/components/transactions/RosterPane.tsx`
  - Reorder row: avatar → FC/BC badge → name → team logo → salary → [−].
  - Bump avatar to `h-8`, padding `py-1.5`.

- `src/components/FiltersPanel.tsx`
  - New top section "VIEW" with the PER GAME / TOTALS toggle.
  - Accept `perfMode` + `onPerfModeChange` props.

- `src/lib/api.ts` — no signature change needed (already accepts `outs:[]`).

- `supabase/functions/transactions-commit/index.ts`
  - Allow `outs.length === 0` only when caller's current roster length < 10; otherwise reject. Also handle `type = "ADD"` instead of `"SWAP"` for the transaction row.

**New**
- `src/hooks/useMediaQuery.ts` (~20 lines) — minimal `useMediaQuery(query)` hook (mirrors existing `useIsMobile` pattern but generic).
- `src/lib/trade-eligibility.ts` (~80 lines) — pure function `getEligibility(player, ctx) → Eligibility` so the same logic is reusable in tests and per-row UI.

### Out of scope

- Filters panel responsive drawer at < 1024px (mention only; not built this round).
- Drag-and-drop between roster pane and table.
- Visual polish of the AI Coach modal trigger (kept as-is).
- Changing the "Add" vs "Swap" type in historical transaction views (we just write the right row; viewer comes later).

