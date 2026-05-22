## Add `/wnba/` prefix to Player Action search URLs

The "By Game" buttons already include the WNBA prefix, but Player Action searches still hit `nbaplaydb.com/search?...` for both leagues. Mirror the same `isWnba ? "wnba/" : ""` prefix everywhere a search URL is built.

### Changes in `src/pages/AdvancedPage.tsx`

1. `handleActionOpen` (line 339): `https://www.nbaplaydb.com/${isWnba ? "wnba/" : ""}search?${params}`
2. `buildNbaPlayDbUrl` (line 415, used in ShareSearchDialog preview): same prefix.

`isWnba` is already in scope from `useLeague()`. No other behavioral changes.

### Result
- WNBA: `https://www.nbaplaydb.com/wnba/search?actionplayer=Breanna%20Stewart`
- NBA: unchanged
