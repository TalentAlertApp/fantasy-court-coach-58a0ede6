## 1) /schedule — List view, recap host, scheduled border

**a) Full team name in list view** — `src/components/ScheduleList.tsx`, list-mode block (`compact === false`, ~line 1086–1088 and the home counterpart). Replace `{g.away_team}` / `{g.home_team}` with `getTeamByTricode(tri)?.name ?? tri`. Keep the logo and score untouched. Compact (grid) view stays on tricode (no room for full name).

**b) Wrong "NBA.COM" badge on recap iframe** — `src/components/ScheduleList.tsx`, `RecapCard` (`recapHost` const, ~line 64). Today it's `league === "wnba" ? "WNBA.com" : "NBA.com"`, so EuroLeague falls through to "NBA.com". Switch to a `league`-aware map: `nba → NBA.com`, `wnba → WNBA.com`, `euroleague → EuroLeague.net`. Same value flows into the YouTube overlay link and the NBA.com placeholder label, so both fixes land at once.

**c) Yellow left border on scheduled cards** — `src/components/ScheduleList.tsx`, `getStatusBorder` (~line 177). Add a `SCHEDULED` branch: return `border-l-[hsl(var(--nba-yellow))]` when status is neither FINAL nor live. FINAL stays green, LIVE stays red. The `border-l-4` is already applied on the card wrapper.

## 2) Fantasy Court Daily — "Outstanding Game" Open button

`src/components/court-show/CourtShowSlide.tsx`, `OutstandingSlide` recap header (~line 627–636). Replace the `<a href={payload.game_recap_url}>` "Open ↗" with a `<button>` that calls `onGameClick(payload.game)` — same handler already used by other recap cards, which opens `GameDetailModal` in `CourtShowModal`. Keep the icon and label ("Open"), drop `ExternalLink` for `Maximize2` for visual consistency with the schedule's full-modal opener.

## 3) /transactions & /roster expanding schedule (`SchedulePreviewPanel` → `MatchupCard`)

File: `src/components/SchedulePreviewPanel.tsx`.

**a-i) Green bar for played games** — `MatchupCard` (~line 391). Today the left border is `border-l-[hsl(var(--nba-yellow))]` only when `involved`. Change the rule to status-driven:
- FINAL → `border-l-green-500`
- SCHEDULED → `border-l-[hsl(var(--nba-yellow))]` (always, not gated by `involved`) — this also resolves 3b (the current "only CON@POR shows yellow" bug is exactly the `involved`-only gate).
- LIVE / unknown → transparent

To know status, extend `GameLite` + `useScheduleWeekGames` select to include `status`, `home_pts`, `away_pts`, plus the recap fields needed for the modal (`game_recap_url`, `nba_game_url`, `game_boxscore_url`, `game_charts_url`, `game_playbyplay_url`, `youtube_recap_id`). The hook already returns most of these — just expand the `.select()` list and the `ScheduleWeekGame` type.

**a-ii) Green recap icon on played games** — In `MatchupCard`, add a small `Tv2` icon button (green when `youtube_recap_id` present, muted otherwise) on the card's top-right corner. On click (stopPropagation), call the existing `onOpenGame` with a `GameDetailGame` built from the row — same shape `ResultDots` already constructs (~line 309). Re-use `GameDetailModal` already mounted in `SchedulePreviewBody`.

**b) Yellow-bar bug on GW4.2** — Resolved by the rule change in (a-i): scheduled cards no longer need `involved` to show the yellow bar; the involved highlight stays on team-name color only.

## Out of scope
- No backend / edge function changes.
- No layout restructuring of `MatchupCard` beyond adding the recap icon.
- Grid (compact) schedule cards untouched for full team names (space-constrained).
