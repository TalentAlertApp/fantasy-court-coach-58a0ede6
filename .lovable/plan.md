

# Round B — Trade Machine: in-page workflow on /transactions (no modal)

You're right — the players table IS the trade machine. The Plus/Minus columns, budget pill, team-cap counts, and filters are already wired for trades. A modal would duplicate all of it. Instead, we **upgrade what's already there** into a true Trade Machine without leaving the page.

## The new mental model

The /transactions page becomes a **persistent trade workbench**: one screen, two zones, live validation everywhere, report on-demand.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Transactions    [PerGame|Totals]                          247 players   │
├─────────────────────────────────────────────────────────────────────────┤
│ TRADE WORKBENCH                                                         │
│ ┌──────────── OUT (0/2) ────────────┐  ┌─── IN (0/2) ──────────────┐    │
│ │  drag/click roster row's [−]      │  │ drag/click any row's [+]  │    │
│ │  to add OUT slot                  │  │ to add IN slot            │    │
│ │  ┌─[Doncic FC $14M ✕]──┐          │  │ ┌─[empty slot]────────┐   │    │
│ │  └────────────────────┘          │  │ └────────────────────┘   │    │
│ └───────────────────────────────────┘  └──────────────────────────┘    │
│ Bank $13.6M  Freed +$14M  →  Available $27.6M     ✅ Valid              │
│ Used 1/2 trades this GW3 · cap reset Tue 03:00 Lisbon                   │
│ [Generate Report] [Reset]   ⓘ Pick OUT first, then equal IN count       │
├─────────────────────────────────────────────────────────────────────────┤
│ PLAYERS TABLE (rows act as IN picker for non-roster, OUT for roster)    │
│  [+] Curry  GSW BC $14M  FP5 48.2  V5 3.4    🚫 over budget            │
│  [+] Brown  BOS BC $12M  FP5 41.1  V5 3.4    ✅                         │
│  [−] Doncic DAL BC $14M  ROSTER  (highlighted gold = in OUT zone)       │
│  ...                                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

## What changes on the page

### 1. Remove the Trade popover (lines 278–318)
The popover duplicates the table. Kill it. The TRADE button is gone — trades happen by clicking row [−] / [+] icons, exactly as today, just with smarter feedback.

### 2. Add a Trade Workbench bar (replaces the current toolbar lines 276–417)
Sticky horizontal bar that always shows:
- **OUT zone** — chips for marked roster players (was the "selected pills" already at line 333)
- **IN zone** — chips for picked replacements (NEW — same shape, green border)
- **Live math** — Bank → Freed → Available, color-coded
- **Trade cap counter** — `1/2 trades this GW3 · resets Tue 03:00 Lisbon` (new — read from `transactions` table)
- **Validity pill** — ✅ Valid / 🚫 reason (FC/BC mismatch, over cap, team limit, count mismatch)
- **[Generate Report]** primary button — opens the report panel inline
- **[Reset]** clears both zones

The All-Star/Wildcard chips stay where they are (right side of bar).

### 3. Rewire the Plus icon (currently line 474)
Today: clicking [+] writes directly to the roster via `supabase.from("roster").insert(...)`. **New behavior**: clicking [+] **stages the player into the IN zone** — no DB write. Only "Generate Report → Commit Trade" persists.

This means the table now serves THREE purposes simultaneously:
- Browse all players (current)
- Stage IN candidates (Plus → IN zone)
- Stage OUT candidates (Minus on roster rows → OUT zone)

### 4. Per-row eligibility badge (NEW column or inline in Plus button tooltip)
For non-roster rows, compute eligibility against `OUT-zone + bank` budget, team count post-trade, FC/BC balance post-trade. Show inline:
- ✅ green Plus (current)
- 🚫 disabled Plus + tooltip reason ("Over budget by $2.1M", "Team cap (2 from BOS)", "Would leave 6 FC / 4 BC")

This is a small upgrade to the existing `addTitle` logic at lines 452–458, expanded to cover FC/BC balance.

### 5. Report panel — inline, not modal
When user clicks [Generate Report], the players table **collapses to half-height** and a Report panel slides up below the workbench. Three sections:

- **Side-by-side diff** — OUT cards (red border) ↔ IN cards (green border)
- **Roster impact table** — Before / After / Δ for: Salary used, Bank, Projected FP5, Projected Stocks5, FC/BC split, Teams used
- **Schedule lookahead** — next-7-days game count for OUT vs IN (uses `useScheduleWeekGames`)
- **AI verdict** — paragraph + pros/cons via new `ai-coach` action `explain-trade`

Bottom of report: **[← Back to picking]** and **[Commit Trade]** (primary). After commit, success toast + roster invalidation + workbench resets, table goes back to full height.

If user clicks [+] or [−] while report is open, report auto-closes back to picking mode.

### 6. Gameweek transfer cap enforcement
On page load, query `transactions` for the current GW window (between current GW deadline and next). Compute `used = count(rows) / 2` (1 trade = 1 IN/OUT pair, stored as 1 row). Display `used/2` in the workbench. If `used >= 2`, disable [+] icons on non-roster rows and show "GW transfer cap reached — resets Tue 03:00 Lisbon" banner above the workbench. All-Star chip → cap = 4. Wildcard → cap = ∞ for the GW.

### 7. The Schedule preview button stays
Already useful when picking IN players (see who has soft schedule next). No changes.

## Backend (same as before, unchanged from approved scope)

- Replace `supabase/functions/transactions-commit/index.ts` stub with real logic: validate server-side, delete OUT from `roster`, insert IN with slot inherited from OUT, write `transactions` rows.
- Add `explain-trade` action to `supabase/functions/ai-coach/index.ts`.
- Add migration: `CREATE INDEX IF NOT EXISTS idx_transactions_team_created ON public.transactions (team_id, created_at DESC);`

## Files touched

**New**
- `src/components/transactions/TradeWorkbench.tsx` — the sticky toolbar with OUT/IN zones, validity pill, budget math (~250 lines)
- `src/components/transactions/TradeReport.tsx` — inline report panel with diff, metrics, schedule, AI verdict (~280 lines)
- `src/hooks/useGameweekTransfers.ts` — GW window query + cap math (~50 lines)
- `src/hooks/useTradeValidation.ts` — pure function hook computing post-trade rule check, used by both workbench and per-row eligibility (~80 lines)

**Modified**
- `src/pages/PlayersPage.tsx`
  - Remove Popover trade dropdown (lines 278–318) and Apply button (lines 374–383)
  - Replace toolbar with `<TradeWorkbench />`
  - Change `handleAddPlayer` from DB insert → push to local `inZone` state
  - Change `toggleRelease` → push to local `outZone` state (already mostly does this — rename for clarity)
  - Pass `inZone/outZone` to per-row eligibility + render report panel conditionally
- `src/lib/api.ts` — add `aiExplainTrade()` and updated `commitTransaction()` signature
- `src/lib/contracts.ts` — schemas for both
- `supabase/functions/transactions-commit/index.ts` — real implementation
- `supabase/functions/ai-coach/index.ts` — `explain-trade` branch

**Migration**: 1 index on `public.transactions(team_id, created_at desc)`.

## Why this is better than a modal

- **No context loss**: filters, sort, search, schedule preview all stay live while picking IN players
- **No duplicated UI**: the table already has [+]/[−] columns wired; we reuse them
- **Report-on-demand**: only renders when user wants to commit — picking is fast and cheap
- **Discoverable**: the workbench is always visible; users see "Used 1/2 trades" without needing to open anything
- **Mobile-friendly later**: workbench can collapse to a single sticky pill, table stays usable

## Out of scope (later rounds)

- Multi-team trades between your own franchises
- Wiring chips to bypass the GW cap (toggles work; backend logic is one-line addition next round)
- Trade history page (data lands in `transactions` now; viewer comes later)
- Undo committed trade

