

## Fix Player Database Import + Dynamic Age Calculation

### Problem
The uploaded TSV has:
- Quoted fields: salary `"22,0"`, height `"6'11""` — the current `split("\t")` leaves quotes in values
- European DOB format `DD/MM/YYYY` — current parser assumes `M/D/YYYY` (American)
- Empty TEAM (released players) and empty `#` (jersey) — must be allowed
- AGE should be calculated from DOB dynamically, not stored as a static number

### Changes

**1. `src/pages/CommissionerPage.tsx`** — Fix TSV parser
- Add a `stripQuotes()` helper to remove surrounding quotes and unescape `""` → `"`
- Apply it to all parsed fields (salary, height, etc.)
- Allow empty `team` and `jersey` values (don't default jersey to "0" if blank, use empty string)

**2. `supabase/functions/import-players/index.ts`** — Fix DOB parsing + allow empty team
- Fix `normDob` to handle `DD/MM/YYYY` format (European) in addition to `M/D/YYYY`
- Allow `team` to be empty string (not null) for released/G-League players
- Allow `jersey` to be 0 when missing
- Strip quotes from salary string before parsing

**3. `supabase/functions/players-list/index.ts`** — Calculate age dynamically
- Instead of using `p.age` from DB, compute age from `p.dob` at query time
- This ensures age is always current

**4. `supabase/functions/player-detail/index.ts`** — Calculate age dynamically
- Same: compute age from `dob` instead of returning stored `age`

### After deployment
You upload the `NBA_dataset_full.tsv` file on `/commissioner` with "Full replace" ON — it will wipe and reimport all 593 players with correct salaries, teams, heights, and DOBs.

### Files changed
| File | Action |
|------|--------|
| `src/pages/CommissionerPage.tsx` | Strip quotes from TSV fields, allow empty team/jersey |
| `supabase/functions/import-players/index.ts` | Fix DOB to DD/MM/YYYY, strip salary quotes, allow empty team |
| `supabase/functions/players-list/index.ts` | Compute age from DOB dynamically |
| `supabase/functions/player-detail/index.ts` | Compute age from DOB dynamically |

