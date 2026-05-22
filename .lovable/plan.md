## 1) `/` MY ROSTER — list view

**a) Remove COLLEGE column (EuroLeague only)**
- `src/components/RosterListView.tsx`: drop the `College` `<TableHead>` when `league === "euroleague"`.
- `src/components/PlayerRow.tsx`: drop the matching `<TableCell>` (line 157) under the same league check.
- Rebalance spacing for the remaining columns (Player / DOB(Age) / HT / Nation / FC-BC / Health / Salary / FP5 / Value5 / Last FP / Total FP / action). Concretely:
  - Drop `min-w-[1080px]` to `min-w-[980px]` to remove the orphan whitespace.
  - Slightly widen the now-visible Nation cell from `w-32` to `w-36` so flag + label breathe; bump DOB cell from `w-[88px]` to `w-[96px]`.
- NBA/WNBA stays exactly as-is (College stays).

**b) Wrong page header (`GAMEWEEK 25 — DAY 6, Deadline Sun 12 Apr 01:00`)**
Root cause — `src/pages/RosterPage.tsx` lines 184–190:
```ts
if (league === "wnba") {
  const gd = getCurrentGamedayFrom(leagueDeadlines);
  if (gd) return gd;
}
return getCurrentGameday();   // ← NBA static table, wrong for EL
```
EuroLeague falls through to the NBA static deadlines table (`src/lib/deadlines.ts`), which is why it lands on the NBA's GW 25 / Day 6 / 12 Apr.

Fix: extend the branch so EuroLeague also reads from `useLeagueDeadlines()` (which already pulls EL tipoffs from `schedule_games` and applies the `-30 min` Lisbon-time rule we wired last loop):
```ts
if (league === "wnba" || league === "euroleague") {
  const gd = getCurrentGamedayFrom(leagueDeadlines);
  if (gd) return gd;
}
return getCurrentGameday();
```
No other roster logic changes — `useDeadlineStatus` and the lock badge already operate on `currentGameday.deadline_utc`.

## 2) `/advanced` — Stats button + missing tabs (EuroLeague)

Root cause — `src/pages/AdvancedPage.tsx` lines 820–846: when `competition.hasAdvancedPlaySearch` is `false` (EL), the whole page short-circuits to the "not available" card whose secondary CTA links to `/scoring`. So users never see Playing Time / Advanced Stats / Trending, even though those tabs run off the same Supabase tables that EL is already populating.

Fix: instead of returning an early fallback, render the existing `<Tabs>` block with `play-search` hidden when `!competition.hasAdvancedPlaySearch`:
- Build the tab list dynamically: include `["play-search", "Play Search"]` only when `competition.hasAdvancedPlaySearch`.
- Change `grid-cols-4` → `grid-cols-${tabs.length}`.
- Default tab: if persisted tab is `play-search` but the league no longer supports it, fall back to `"playing-time"`.
- Remove the early-return fallback block entirely (or keep a tiny inline "Play Search is NBA-only" note above the Playing Time tab — optional, ask if you want it).
- Header label "Advanced · NBA Insights" → use `competition.label` so EL shows "Advanced · EuroLeague Insights".

The three remaining tabs (`PlayingTimeTrends`, `AdvancedStatsTab`, `TrendingTab`) already read via `useLeagueId()` / league-scoped queries, so they will populate from the EuroLeague rows you've already synced — no edge-function changes required.

## 3) YouTube recap pipeline — leverage the official page

Today `youtube-recap-lookup` calls YouTube's Search API with alias scoring. Hit rate is poor (last run: 0/100). But every EuroLeague game already carries a deterministic recap URL on `euroleaguebasketball.net`, and that page embeds the exact YouTube video the user wants. So we can pivot to a **scrape-first, search-fallback** strategy.

**New edge function: `euroleague-recap-scrape`**
- Accepts `?league=euroleague&limit=N` (admin-secret guarded, same shape as the existing recap lookup).
- For each EL game missing `youtube_recap_id`:
  1. Build the deterministic Euroleague videos URL pattern from `away_team`, `home_team`, `round`, season. Two strategies, tried in order:
     - **Strategy A (preferred):** fetch the round index page `https://www.euroleaguebasketball.net/euroleague/game-center/round-{round}/2025-26/` and parse the game cell that matches `{away}-{home}` (uses the slugs we already store).
     - **Strategy B (fallback):** construct the canonical highlights URL `https://www.euroleaguebasketball.net/euroleague/videos/{away-slug}-{home-slug}-round-{ROUND_CODE}-highlights-2025-26-euroleague/` and probe it (HEAD/GET).
  2. Once the official page HTML is loaded, extract the YouTube ID by regex over the page source:
     - `youtube\.com/(?:watch\?v=|embed/)([A-Za-z0-9_-]{11})`
     - `youtu\.be/([A-Za-z0-9_-]{11})`
     - JSON-LD `"embedUrl":"https://www.youtube.com/embed/<id>"`
  3. On match, update `schedule_games.youtube_recap_id` and `recap_source = 'euroleague.net'`.
- No YouTube Data API quota burn. Existing `youtube-recap-lookup` stays as a backup for misses.

**Commissioner UI**
- `EuroleagueSheetSyncPanel.tsx`: add a new button **"Scrape Recaps from Euroleague.net"** alongside "Find YouTube Recaps", calling the new function and showing `processed / found / remaining` like today.

**Answer to your "which job do I run":** after we ship this, you run **Scrape Recaps from Euroleague.net** first (it should resolve nearly all 433 missing). Re-run **Find YouTube Recaps** only as the long-tail fallback. No DB migrations — `youtube_recap_id` already exists.

## Files touched
- `src/components/RosterListView.tsx` (conditional column)
- `src/components/PlayerRow.tsx` (conditional cell)
- `src/pages/RosterPage.tsx` (deadline branch)
- `src/pages/AdvancedPage.tsx` (drop short-circuit, dynamic tabs)
- `src/components/commissioner/EuroleagueSheetSyncPanel.tsx` (new button + result row)
- `supabase/functions/euroleague-recap-scrape/index.ts` (new)

No schema migrations.