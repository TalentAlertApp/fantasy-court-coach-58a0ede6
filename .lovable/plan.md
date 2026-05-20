## Goal
Make each player's **salary at acquisition time** the value that counts against the $100M roster cap. The **current market salary** only matters when buying or selling a player (trades / signings). Add a "Roster cost (locked)" row to the Roster Info card, and put FC / BC starters on a single row.

## Data model

Add a column to `roster`:
- `acquired_salary numeric(6,2)` — the player's market salary at the moment they entered this roster slot (signing, draft pick, or trade-in). Immutable for the lifetime of that roster row.

Backfill: for every existing `roster` row, set `acquired_salary = players.salary` (best available proxy — we have no history). Make NOT NULL after backfill.

No other schema changes.

## Server logic

### `roster-save` (initial draft + onboarding)
When inserting roster rows, stamp `acquired_salary = players.salary` for each pid (single `players` lookup we already do). `bank_remaining = cap − Σ acquired_salary`.

### `roster-current`
Stop summing `players.salary`. Sum `roster.acquired_salary` instead and return both:
- `salary_used_locked` (Σ acquired) — drives the cap
- `salary_used_market` (Σ current `players.salary`) — informational
- `bank_remaining = cap − salary_used_locked`

### `transactions-simulate`
Rewrite the cap math:
- `before.locked = Σ acquired_salary` of current roster
- `freed = Σ current players.salary` of OUT players (market sell value)
- `cost  = Σ current players.salary` of IN players
- `after.locked = before.locked − Σ acquired_salary(OUT) + Σ current.salary(IN)`
- Validation: `after.locked ≤ salary_cap`
- `available_to_spend = (cap − before.locked) + freed`; surface this so the picker can gate "+" buttons.
- Include per-OUT `freed_value` and per-IN `cost` in the response for the trade report.

### `transactions-commit`
Same math as simulate. When inserting new roster rows for IN players, set `acquired_salary = current players.salary`. Retained rows keep their existing `acquired_salary` untouched (delete-then-insert pattern must preserve it — switch to a diff: delete only OUT rows, insert only IN rows; update captain / slot via UPDATE).

### Daily salary auto-adjust / season backfill
No change to `players.salary` behaviour. These jobs continue to move the *market* value only; locked roster cap is unaffected, which is exactly the desired behaviour.

## Client logic

### `useTradeValidation` / `TradeWorkbench` / Available Players list
- Replace "available bank" computation with the new `available_to_spend` from simulate (or compute locally as `(cap − lockedUsed) + Σ current.salary(OUT)`).
- `getEligibility` (`src/lib/trade-eligibility.ts`) keeps the same signature — caller just passes the new `availableBudget`. The per-player cost compared against it is the player's **current** salary.

### `RosterSidebar` (Roster Info card)
- Add a new row **"Roster Cost (locked)"** showing `$X.X` = Σ acquired_salary, with a tooltip: "Sum of each player's salary at the moment they joined your roster. This is what counts against the $100M cap."
- Keep existing "Total Salary" row (= market value sum) for reference, renamed to **"Market Value"** so the distinction is obvious.
- Collapse **FC Starters** and **BC Starters** into one row: label on the left, two compact badges (`FC 3` `BC 2`) on the right. Vertical height of the card must not grow.

### Player rows / modals
No change to the displayed player salary — that remains the current market value. Optionally show a tiny "locked at $X.X" chip on roster rows (out of scope unless requested).

## Files touched

- `supabase/migrations/<new>.sql` — add column + backfill + NOT NULL.
- `supabase/functions/roster-save/index.ts`
- `supabase/functions/roster-current/index.ts`
- `supabase/functions/transactions-simulate/index.ts`
- `supabase/functions/transactions-commit/index.ts`
- `src/hooks/useTradeValidation.ts` (or wherever bank is computed for the trade UI)
- `src/components/transactions/TradeWorkbench.tsx` + `RosterPane.tsx` (pass new bank)
- `src/components/RosterSidebar.tsx` (new row + FC/BC inline)
- `src/lib/api.ts` typing for the new response fields.

## Out of scope
- Historical reconstruction of true acquisition prices (we only have today's market value; backfill uses that as the baseline going forward).
- Changing how `players.salary` itself is computed.
