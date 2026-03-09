

## Fix: Player Modal Shows Empty Data

### Root Cause
The `player-detail` edge function response shape doesn't match the `PlayerDetailPayloadSchema` Zod contract. The client does `schema.parse(json)` which throws on mismatch, so the modal renders with no data.

### Mismatches Found

| Section | Edge function returns | Contract expects |
|---------|----------------------|-----------------|
| `history[].game_date` | `game_date` | `date` |
| `history[].home_away` | nullable | `"H" \| "A"` (non-nullable) |
| `upcoming[].date` | `date` | `tipoff_utc` |
| `upcoming[].opp` | `opp` | `away_team` + `home_team` |
| `upcoming` | missing `status` | `status: "SCHEDULED"` |

### Fix: Update `supabase/functions/player-detail/index.ts`

Align the response mapping to match the contract:

**History items** - rename `game_date` → `date`, ensure `home_away` defaults to `"H"`, ensure `opp` defaults to empty string.

**Upcoming items** - return `{ game_id, tipoff_utc, away_team, home_team, status }` instead of `{ game_id, date, opp, home_away, matchup }`.

### Files
- `supabase/functions/player-detail/index.ts` — fix response field mapping

No database or client changes needed. The contract and modal code are already correct.

