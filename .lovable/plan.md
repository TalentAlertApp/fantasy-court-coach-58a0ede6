## Plan

### Issue 1 — MAIN EUROLEAGUE missing from My Leagues
**Root cause:** `src/pages/LeaguesPage.tsx` builds `sortedLeagues` by explicitly picking the NBA and WNBA main leagues and then appending everything that is *not* a main league. The EuroLeague main league (`00000000-0000-0000-0000-000000000030`) is therefore filtered out — it’s a main league, but it isn’t pinned, so it disappears. The Discover panel uses a separate query (`leagues-discover`) that has no such filter, which is why it still shows there.

```text
sortedLeagues = [nbaMain, wnbaMain, ...nonMain]   // euroleagueMain dropped here
```

**Fix:** also pick `euroleagueMain` (via `MAIN_LEAGUE_EUROLEAGUE_ID`, already exported from `useFantasyLeagues`) and prepend it alongside the other two pinned main leagues. The downstream `leaguesWithMineCount` already handles any sport via `isMainLeague(...)`, so no further changes needed.

### Issue 2 — EuroLeague logo too small in the sidebar team pill
**Root cause:** `LeagueLogoBadge` renders every league at the same pixel box (`h-3.5/h-4/h-5`). The EuroLeague PNG has built-in transparent padding, so it visually reads smaller than the NBA/WNBA marks. `COMPETITIONS.euroleague` already declares `logoScale: 1.25` for exactly this case, but the badge ignores it.

**Fix:** in `src/components/LeagueLogoBadge.tsx`, read `comp.logoScale` and apply it via inline `transform: scale(...)` on the `<img>`. Keeps the layout box identical (so surrounding spacing doesn’t shift) while the glyph itself grows to match the NBA/WNBA visual weight in the header pill and the dropdown items.

### Files touched
- `src/pages/LeaguesPage.tsx` — include EuroLeague main league in `sortedLeagues`.
- `src/components/LeagueLogoBadge.tsx` — apply per-competition `logoScale`.

No backend, schema, or edge-function changes. No business logic changes — purely list assembly + presentation.