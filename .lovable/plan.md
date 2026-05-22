# Plan — Nationality flags + Recap scraper diagnosis

## 1) Nationality flags — root cause

`src/lib/nationality.ts` ships a hand-written `COUNTRY_ISO` map seeded for NBA/WNBA only. Every EuroLeague country that isn't already in that map renders as "no flag", and any value with diacritics or an alternate spelling (Türkiye, Côte d'Ivoire, Cabo Verde, etc.) silently misses the lookup because the key compare is a plain lowercase string match.

### Fix

Rework `nationality.ts` so the lookup is resilient and the map is comprehensive:

- Normalize the input before lookup: lowercase + strip diacritics (`String.prototype.normalize("NFD").replace(/\p{Diacritic}/gu, "")`) + collapse whitespace + drop punctuation (apostrophes, periods).
- Add **aliases** so each ISO code can be reached via every common spelling we see in `DB_Players`:
  - Turkey: `turkey`, `turkiye`, `türkiye`, `republic of turkey`
  - Ivory Coast: `ivory coast`, `cote divoire`, `côte d'ivoire`, `cote d ivoire`
  - Cape Verde: `cape verde`, `cabo verde`
  - North Macedonia: `north macedonia`, `macedonia`, `fyrom`
  - Czech Republic: `czech republic`, `czechia`
  - Denmark: `denmark`
  - Cuba: `cuba`
  - Angola: `angola`
  - Chile: `chile`
  - Colombia: `colombia`
  - Plus the rest of EuroLeague-relevant nations not in the current map: Argentina, Israel (already in), Egypt, Tunisia, Algeria, Morocco, South Africa, Iceland, Norway, Estonia, Romania, Bulgaria, Slovakia, Belarus, Armenia, Kosovo, Albania, Venezuela, Uruguay, Panama, DR Congo (variants), Ireland, Ghana, Kenya, Sudan, Cyprus, Luxembourg, Iran, Lebanon.
- Keep `countryLabel` returning a clean display name (map "Turkiye" → "Türkiye", "Cabo Verde" → "Cabo Verde", etc. for the tooltip).
- Add a tiny vitest covering the problematic spellings so regressions surface.

Files touched: `src/lib/nationality.ts` (+ one test under `src/test/`).
No DB or schema changes — flag rendering is purely client-side.

## 2) "Scrape Recaps from Euroleague.net" — 0 / 200 explained

Diagnosis run from this sandbox against two known recap URLs:

```text
HTTP 429  SIZE ~33 KB   (Euroleague.net anti-bot challenge page)
```

The page is **blocked at the edge**. Supabase Edge Functions hit the same WAF from a cloud IP and almost certainly get the same 429 (or a JS challenge) — our regex finds 0 YouTube IDs because the body returned is a block page, not the highlights page. Even when the page does load, the embed is served by Euroleague's own player (Brightcove/Diva), not a raw YouTube iframe, so the YT ID would still need to come from a side channel.

### Recommended pivot (no more scraping euroleaguebasketball.net)

Replace the scrape path with a **YouTube Data API search scoped to the official EuroLeague channel + game date**, which is the same approach that works for NBA/WNBA:

- Channel: `UCXC0cXl5kIeBM0Aau-T7yKw` (official @EuroLeague).
- For each game missing `youtube_recap_id`:
  1. `search.list` with `channelId=<EuroLeague>`, `q="<away alias> <home alias> highlights"`, `publishedAfter = tipoff`, `publishedBefore = tipoff + 72h`, `maxResults=10`.
  2. Score titles using the existing `EUROLEAGUE_TEAM_ALIASES` (require ≥1 alias from each side, bonus for "highlights"/"round").
  3. If channel-scoped search yields nothing, fall back to an open search (current `youtube-recap-lookup` behaviour) — but still date-bounded.
- Persist the chosen `youtube_recap_id`. Player stays YouTube on the modal (already the case — that "NBA.com" link was patched last round).

Concretely:
- Retire the `euroleague-recap-scrape` button (keep the edge function file for now, just hide the UI trigger; or delete both — your call).
- Extend `youtube-recap-lookup` to accept `league=euroleague`, add a `EUROLEAGUE_CHANNEL_ID` constant, and run the channel-scoped pass before the open one. Keep date windowing strict to avoid pulling pre-game preview clips.
- In `EuroleagueSheetSyncPanel.tsx`, route the existing "Find YouTube Recaps" button at EuroLeague mode.

### Why this should resolve nearly all 433 missing

The official @EuroLeague channel publishes a "{Away} vs {Home} | Highlights" video for every game within ~12 h of tipoff. Channel-scoped + date-bounded search has near-100 % precision on NBA/WNBA today; aliases already cover the city/nickname variants.

### Quota note

YouTube Data API `search.list` costs 100 units/request. 433 games × 1 call ≈ 43 300 units — under the daily 10 000-per-key limit only if we batch across a few days, or request a quota bump. Easiest path: process in nightly chunks of ~80 games (8 000 units) via the existing schedule tick, OR ask the user to request a one-off quota lift (free) before a single backfill run.

## Action for the user

- Approve the plan; on implement I'll ship (1) immediately and (2) as a single change to `youtube-recap-lookup` + the panel button. After deploy, run **Find YouTube Recaps** with EuroLeague selected — the scrape button can be ignored / removed.
