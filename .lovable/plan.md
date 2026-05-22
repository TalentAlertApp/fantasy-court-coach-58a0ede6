## Fix Play Search "By Game" URL dates

Compute the game date from each game's `tipoff_utc` in `America/New_York` instead of using the gameday-level Lisbon `yyyymmdd`. Applies to both NBA and WNBA.

### Change

In `src/pages/AdvancedPage.tsx`, replace the gameday-derived `yyyymmdd` used in the game URL with a per-game ET date:

```ts
const gameDateET = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(selectedGame.tipoff_utc)).replace(/-/g, "");

window.open(
  `https://www.nbaplaydb.com/${isWnba ? "wnba/" : ""}games/${gameDateET}-${away}${home}`,
  "_blank"
);
```

### Result
- WNBA CON@NYL (GW1.1, tipoff 2026-05-08 23:30 UTC → 19:30 ET May 8) → `/wnba/games/20260508-CONNYL` ✓
- NBA HOU@OKC (GW1.1, tipoff Oct 22 00:30 UTC → 20:30 ET Oct 21) → `/games/20251021-HOUOKC` ✓

### Out of scope
Action/player search URLs and `ShareSearchDialog` remain unchanged.
