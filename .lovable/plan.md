

## Add left-side Roster pane on /transactions; exclude roster players from right-side table

### New 3-column layout (desktop)

```text
┌──────────────────────────────────────────────────────────────────┐
│  Transactions   [PerGame|Totals]                  N players      │
│  TRADE WORKBENCH (full width — sticky)                           │
│  [Schedule] [AI Coach]                                           │
│  TRADE REPORT (when open, full width)                            │
├──────────┬───────────────────────────────────────┬───────────────┤
│ MY ROSTER│  AVAILABLE PLAYERS (table)            │  FILTERS      │
│ (left)   │  — excludes roster players —          │  (right)      │
│ w-64     │  flex-1                               │  w-56         │
│          │                                       │               │
│ Starter5 │  [+] Curry  GSW BC $14M  ✅           │  FC/BC        │
│  • A [-] │  [+] Brown  BOS BC $12M  ✅           │  Search       │
│  • B [-] │  ...                                  │  Max salary   │
│  • C [-] │                                       │  Team         │
│  • D [-] │                                       │               │
│  • E [-] │                                       │               │
│ Bench    │                                       │               │
│  • F [-] │                                       │               │
│  • ...   │                                       │               │
└──────────┴───────────────────────────────────────┴───────────────┘
```

### Behavior

**Left pane — `<RosterPane />`** (new component, `src/components/transactions/RosterPane.tsx`)
- Sticky, scrolls independently when content overflows.
- Two sections with mini section bars: **STARTING 5** and **BENCH**, matching the look of `RosterListView` section bars (`section-bar` class).
- Compact rows: avatar (h-7), team logo, name, FC/BC badge, salary, and a `[−]` button on the right.
- `[−]` calls the same `toggleOut(id)` already in `PlayersPage` — players staged into OUT zone get a destructive-tinted background ring on the row.
- Click anywhere else on the row → opens `PlayerModal` (reuses existing `setSelectedPlayerId`).
- Empty state: "Roster loading…" skeleton if `rosterPlayers` is empty.

**Right table — exclude roster players**
- Add one filter line in the existing `filtered` memo: `items = items.filter((p) => !rosterPlayerIds.has(p.core.id));`
- Removes the `ROSTER` badge case and the `[−]` branch from the table row (no roster players will appear there anymore). Table only renders the `[+]` IN-stage button.
- Player count chip in header now reads "N available" (post-exclusion count).

**Trade Workbench, Trade Report, Filters, AI Coach, Schedule preview** — unchanged. Workbench OUT zone still mirrors what's clicked in either the left pane or (no longer applicable) the table.

### Files touched

- **New**: `src/components/transactions/RosterPane.tsx` (~120 lines) — pure presentation, receives `rosterPlayers`, `outZone`, `onToggleOut`, `onPlayerClick`.
- **Modified**: `src/pages/PlayersPage.tsx`
  - Add `<RosterPane />` as first column in the bottom flex container (line 452).
  - Add `!rosterPlayerIds.has(p.core.id)` filter inside `filtered` memo (line 251).
  - Remove the `isOnRoster` `[−]` branch in the table row (lines 503–512); always render `[+]` button.
  - Update player count label to reflect post-exclusion count.
  - Remove the `ROSTER` badge in the player name cell (line 534) since roster players no longer appear in the table.

### Why this is the right shape

- The roster is now always visible — users see exactly what they can release without scrolling/searching.
- The right table becomes a true **available pool** (no duplicate rows, no clutter).
- OUT zone in the workbench stays the single source of truth — both the left pane and workbench show the same selected chips.
- All existing trade rules, validation, GW cap, schedule preview, and report keep working unchanged.

### Out of scope

- Drag & drop between panes (clicks already work; can add DnD later).
- Mobile responsive collapse of the left pane (deferred — current viewport is desktop 1381px).

