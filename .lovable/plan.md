

## Plan: Daily-games picker, working Player Matchup URL, retry of weak recap matches

### 1. `/advanced` → "By Game": replace Away/Home selects with a daily games dropdown
File: `src/pages/AdvancedPage.tsx`

Replace the two team `<Select>`s with a single **Game** select that lists the actual games scheduled on the chosen date, fetched from Supabase. URL composition stays identical (`gamecode = YYYYMMDD/AWAYHOME`), just derived from the picked game instead of two manual inputs.

- Keep the existing `<Input type="date">` as `Game date` (default today). On change, fetch the games for that date.
- New hook (inline in this file): `useGamesByDate(date)` — `useQuery(['games-by-date', date], …)` running `supabase.from('schedule_games').select('game_id, away_team, home_team, tipoff_utc, status').gte('tipoff_utc', startOfDayUTC).lt('tipoff_utc', endOfDayUTC).order('tipoff_utc')`. Use a 2-hour stale time. Convert the local date to a UTC window (Europe/Lisbon midnight → next midnight) using simple `new Date(date + "T00:00:00")` math to be consistent with the rest of the app.
- New `<Select value={gameId} onValueChange={setGameId}>`:
  - Trigger label: `Pick a game`. Disabled while loading; shows `No games on this date` when empty.
  - Each `SelectItem` value = `game_id`. The visible row mirrors the `/transactions` styling already used on this page: full team names + watermarked logos.
    ```tsx
    <SelectItem value={g.game_id}>
      <div className="relative flex items-center gap-2 w-full pr-12">
        <img src={getTeamLogo(g.away_team)} className="w-5 h-5" />
        <span className="font-medium">{TEAM_NAME[g.away_team]}</span>
        <span className="text-muted-foreground mx-1">@</span>
        <img src={getTeamLogo(g.home_team)} className="w-5 h-5" />
        <span className="font-medium">{TEAM_NAME[g.home_team]}</span>
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
          {format(g.tipoff_utc, "HH:mm")}
        </span>
      </div>
    </SelectItem>
    ```
  - Add `TEAM_NAME` from existing `NBA_TEAMS` map.
- Drop the separate Away / Home selects and the manual `away`/`home` state. Compute `selectedGame = games?.find(g => g.game_id === gameId)`, then `yyyymmdd = date.replaceAll("-", "")` and `gamecode = ${yyyymmdd}/${selectedGame.away_team}${selectedGame.home_team}`.
- `gameSearchDisabled = !selectedGame`. Both buttons (`Open on NBAPlayDB` / `View Game Page`) keep their current URLs and disabled logic, just sourced from `selectedGame`.

### 2. `/advanced` → "Player Matchup": fix URL params + relayout button inline
File: `src/pages/AdvancedPage.tsx`

NBAPlayDB only natively recognizes `actionplayer` as a URL filter (verified by hitting their search endpoint with `defensivePlayers`, `defenseplayer`, `playerinvolved`, `defender` — none of them appear in the "Active Filters" panel; only `actionplayer=` registers). The current `offensivePlayers=…&defensivePlayers=…` URL renders the no-filters landing page, which is what the screenshot shows.

Fix the URL builder to use the params NBAPlayDB actually honours:
- Primary filter: `actionplayer={offensivePlayer}` (verified working).
- Defender intent: combine into a free-text `q` so NBAPlayDB at least narrows results to plays mentioning the defender:
  ```ts
  const url = `https://www.nbaplaydb.com/search`
    + `?actionplayer=${encodeURIComponent(offensivePlayer)}`
    + `&q=${encodeURIComponent(defensivePlayer)}`;
  ```
  This guarantees the offensive player filter is applied (chip visible in the Active Filters bar) AND injects the defender's name as a search term so the result list is biased toward plays involving that defender. It's the closest behaviour NBAPlayDB exposes today; I tested several plausible defender param names and none filtered.
- Add a small `<p className="text-[10px] text-muted-foreground">` under the selectors: `Offensive player applied as filter; defender added as a search term.` So expectations match reality.

Layout — move the primary button inline with the two selectors at the far right:
- Change the wrapper from `grid sm:grid-cols-2 gap-3` to `grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end`.
- The third grid cell holds the `Open Matchup on NBAPlayDB` button (`h-10`, matching the `PlayerCombobox` trigger height).
- Move the `Clear` ghost button beside it (still inside the third cell, `flex gap-2`).
- Remove the bottom `flex` row that previously hosted the buttons.
- On stack (mobile), the third cell wraps below as a full-width row.

### 3. `/commissioner` Game Recaps — guarantee weak/missed matches are re-searched on the next run
File: `supabase/functions/youtube-recap-lookup/index.ts`

Today the function already re-targets `youtube_recap_id IS NULL`, BUT the scoring fallback `videoId = bestScore >= 3 ? best?.id?.videoId : (items[0]?.id?.videoId ?? null)` ALWAYS stamps the first item even when the title doesn't match either team's city or the words "recap"/"highlights". Once a wrong/weak video is stored, the row no longer satisfies `IS NULL` and never gets re-searched.

Two changes:

3a. **Reject low-confidence matches** so they remain `null` and are picked up by future runs:
```ts
// Require at least both team mentions OR (one team + recap/highlights keyword).
const videoId = bestScore >= 3 ? best?.id?.videoId : null;
```
Drop the `items[0]` fallback entirely. This means a noisy YouTube response leaves the DB column null and the next invocation tries again (potentially with a refreshed YouTube index that now surfaces the correct upload).

3b. **Add a "Re-scan low-confidence recaps" mode** — accept a query param `?force_below=<score>` (default 0). When present and >0, additionally clear `youtube_recap_id` for FINAL games whose stored video title (we don't store titles, so use a different signal) — simpler: support `?clear=1` which sets `youtube_recap_id = NULL` for ALL FINAL games before the search loop runs. The Commissioner gets a new button "Re-scan All Recaps" wired to `?clear=1&limit=100`, so the operator can invalidate prior questionable matches in one click. Reuse the existing `Populate YouTube Recaps` button for the default null-only mode.

Bonus polish in the same file:
- Bump the search query term ordering to `${awayFull} vs ${homeFull} ${dateStr} game recap highlights` (more keyword variety helps relevance).
- Add `videoDuration=medium` (NBA recaps run ~6-12 minutes) to filter out 15-second TikTok-style cross-posts.
- Increase `maxResults` from 5 to 8 for a wider candidate pool, since we now reject low-confidence picks.

No client-side wiring change is strictly required for 3a; the existing `/commissioner` button keeps working and now produces fewer wrong assignments. 3b adds one button that calls the same function with `?clear=1` and shows the existing toast message.

### Files touched
- `src/pages/AdvancedPage.tsx` — new `useGamesByDate` query + Game select; remove Away/Home selects; rewire matchup URL to `actionplayer=…&q=…`; move buttons inline with selectors.
- `supabase/functions/youtube-recap-lookup/index.ts` — drop the unconditional first-item fallback so weak matches stay null; add `?clear=1` mode for full re-scan; tighten YouTube query.
- `src/pages/CommissionerPage.tsx` — add a second button "Re-scan All Recaps" beside "Populate YouTube Recaps", calling the same edge function with `?clear=1&limit=100`.

### Verification
- `/advanced` → By Game: pick `2026-04-20` → the Game select lists three games (`MIN @ DEN`, `ATL @ NYK`, `TOR @ CLE`) with logos + tipoff time; choose one → buttons enable; clicking `Open on NBAPlayDB` opens `…/search?gamecode=20260420%2FMINDEN`.
- `/advanced` → Player Matchup: select Aaron Gordon (offense) + Shai Gilgeous-Alexander (defense) → URL = `…/search?actionplayer=Aaron%20Gordon&q=Shai%20Gilgeous-Alexander` → page shows the `Actionplayer: Aaron Gordon` chip and result list narrowed by SGA's name. The `Open Matchup on NBAPlayDB` button now sits at the far right of the selector row; `Clear` next to it.
- `/commissioner` → click "Populate YouTube Recaps" — wrong-game IDs no longer get written; rows whose YouTube response had no high-confidence match remain null and are retried automatically next run. Clicking the new "Re-scan All Recaps" clears every FINAL row's `youtube_recap_id` then re-runs the lookup.

