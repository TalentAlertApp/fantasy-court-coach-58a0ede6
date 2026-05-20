## Plan

1. **Stop the frontend from bypassing validation**
   - Change `useCourtShowData` so it does not read `court_show_intelligence` directly as the source of truth for Ballers.IQ.
   - Have it invoke `court-show-intelligence` first and use the function response, because the function contains the league/cache validator.
   - Keep React Query keys league-aware (`leagueId`, `league`, `gw`, `day`) so NBA/WNBA views cannot reuse each other’s data.

2. **Make cache invalidation automatic and strict**
   - Bump the validator version again.
   - Treat any cached row as stale if any card is missing `league` or `_v`, has the wrong league, mentions an off-slate team code, or mentions blocked NBA/WNBA team terms.
   - Add a hard `force`/invalid-cache path that deletes or overwrites bad rows instead of allowing them to remain visible.

3. **Strengthen the WNBA team-term detector**
   - Fix the current false-negative issue caused by excluding shared WNBA/NBA cities like `Portland` and `Toronto`; these can still be wrong when the slate does not include those teams.
   - Build two checks:
     - cross-league nickname/full-name blocker (`Trail Blazers`, `Raptors`, etc.)
     - off-slate current-league city/nickname/full-name blocker (`Portland`, `Toronto Tempo`, etc. unless those teams are actually on the WNBA slate)
   - Apply both checks to cached cards and freshly generated cards.

4. **Clear the polluted cache fully**
   - Remove existing WNBA `court_show_intelligence` rows that predate the validator stamp or contain known NBA leakage.
   - Regenerate on next Daily Court Show open through the fixed edge function.

5. **Validate the fix**
   - Query the WNBA cache for leaked NBA terms such as `Trail Blazers`, `Raptors`, `Mavericks`, `Warriors`, `Pacers`, `Luka`, `Curry`, etc.
   - Directly call `court-show-intelligence` for the reported WNBA slate and confirm returned cards are WNBA-only, validator-stamped, and slate-safe.
   - Deploy the updated edge function after the source changes.