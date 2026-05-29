# Fix: EuroLeague team badges all show the generic league crest

## What's wrong
On `/teams` (every tab) for `league = EuroLeague`, every team badge renders the same generic EuroLeague crest instead of each club's real logo.

The database is fine — `sport_teams` has a correct per-club `logo_url` for all 20 EuroLeague teams (verified). The bug is a **render-timing issue in `src/hooks/useLeagueTeams.ts`**:

```text
1. Query returns rows  ──►  euroleagueTeams useMemo recomputes
2. useMemo calls getEuroLeagueTeamRecord() which reads a MODULE-LEVEL map
3. That map is only filled inside a useEffect (runs AFTER render commits)
4. So on the render where data arrives, the map is still empty
   ──► logo falls back to t.logo = euroleagueLogo (generic crest)
5. The useEffect then fills the map, but euroleagueRows never changes again
   ──► the memo never recomputes ──► logos stay stuck on the crest forever
```

Because all three tabs (Teams cards, Standings, Stats) read their logos from the same `leagueTeams` array produced by this hook, all of them break together.

## The fix
Resolve each EuroLeague club's logo (and name/venue) **directly from the fetched `euroleagueRows`** inside the memo, instead of from the side-effect-populated module registry. This removes the ordering dependency entirely.

### `src/hooks/useLeagueTeams.ts`
- In the `euroleagueTeams` memo, build a local lookup from `euroleagueRows` (keyed by uppercased `team_code` and lowercased `name`) and use it to fill `logo`, `name`, `venueName`, `venueImage`.
- Keep `synced?.logo_url || t.logo` semantics but source `synced` from the local lookup, not `getEuroLeagueTeamRecord`.
- Keep the existing `registerEuroLeagueTeams(euroleagueRows)` `useEffect` untouched — it still feeds the synchronous `getTeamLogo()` consumers (e.g. the Standings BallersIQ side panel). Those re-render after the registry is populated, so they resolve correctly.

No other files need changes; the static `EUROLEAGUE_TEAMS` crest stays only as the instant pre-load placeholder.

## Verification
- Open `/teams` with EuroLeague selected and confirm each club shows its own logo across the **Teams**, **Standings**, and **Stats** (Fantasy / Efficiency / Depth / Schedule) tabs.
- Confirm NBA and WNBA team logos are unaffected.
