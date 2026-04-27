## 1) /schedule — inline player blurbs on each game card (List view)

Add a single, centered, italic sentence per game card, sandwiched between the two team blocks (sits inline with the score, centered under the `@ / FINAL / tipoff` column). Renders in **List view only** — leaves grid view untouched, per the request.

### a) Played games → "Outstanding Players"
- Source: `useGameBoxscoreQuery(game_id)` (already used for the expanded box score).
- Logic: for each team, pick the player with the highest `fp`. Build one assertive, slang-flavored sentence using their leading stat lines.
- Template engine (deterministic, no AI, no latency, refreshes for free with the data):
  - Identify the dominant category from the leader's line: PTS ≥ 25 → "dropped 28 PTS", AST ≥ 8 → "dished 9 dimes", REB ≥ 12 → "crashed the glass for 13", STL+BLK ≥ 5 → "wreaked havoc with 4 stocks", FP ≥ 50 → "went nuclear (52 FP)".
  - Sentence shape: `"<TeamA leader> <verb phrase>; <TeamB leader> <verb phrase>."`
  - Lazy-loaded: hook only fires when the boxscore is in cache OR when the game is final and the card is in viewport (we already call the hook inside the box-score panel; we'll add a **prefetch on first render** for finals using react-query's `useQueries` batched at the list level — keeps it cheap, one fetch per final game).
- Visual: small italic line in `text-[11px] text-muted-foreground` with a tiny yellow `Star` icon prefix and the label `Outstanding Players ·` in `font-heading uppercase tracking-wider text-[9px] text-[hsl(var(--nba-yellow))]`.

### b) Scheduled games → "Players to Watch"
- Source: `usePlayersQuery({ limit: 1000 })` (already cached by Advanced page; we'll reuse the same query key so it's free).
- Logic per team: filter `items` by `core.team`, sort by `season.fp` desc, pick top 1 per side. Use `last5.fp5` and `computed.value5` for the slang blurb when meaningful.
  - Template: `"<A leader> riding <fp5> FP5 (V5 <value5>); <B leader> averaging <fp> FP all year — must-watch matchup."`
  - Slang variants chosen by deltas: `delta_fp > 5` → "heating up"; `delta_fp < -5` → "due for a bounce-back"; `injury` → "questionable but locked in" (skipped if OUT).
- Visual: identical placement, with a small blue `Eye` icon and label `Players to Watch ·`.

### Files
- `src/components/ScheduleList.tsx`
  - New helper `buildOutstandingBlurb(boxscorePlayers, awayTeam, homeTeam): string`.
  - New helper `buildWatchBlurb(allPlayers, awayTeam, homeTeam): string`.
  - New component `<GameCardBlurb game viewMode="list" />` that renders the line; only mounted in the **list-view** branch (lines ~969–1130 inside `ScheduleList`), placed directly under the center `@ / status / tipoff` column.
  - Add a list-level prefetch: `useQueries` over `games.filter(isFinal).map(g => ({ queryKey: ["game-boxscore", g.game_id], queryFn: () => fetchGameBoxscore(g.game_id), staleTime: 5*60_000 }))` so the blurb resolves without expanding the row.
- No changes to grid view, no API changes.

---

## 2) /advanced — new tables + Trending tab

Restructure the page around a top-level `<Tabs>` so the existing content keeps its home and new content gets dedicated space.

```text
+------------------------------------------------------+
| NBA Play Search (unchanged, sits above the tabs)     |
+------------------------------------------------------+
| [ Playing Time ] [ Advanced Stats ] [ Trending ]     |
+------------------------------------------------------+
| <active tab content>                                 |
+------------------------------------------------------+
```

Default tab: **Playing Time** (current behavior — zero regression).

### a) "Advanced Stats" tab — new tables off `players.advanced`
Three side-by-side leaderboard tables (responsive grid: 1 col mobile, 3 col xl), each with a sortable header, top-10 rows, sticky team logo + player avatar:

1. **Shooting Splits** — columns: Player · Team · FG% · 3P% · FT% · TS% (computed). Sorted by configurable column (default FG%). Min filter: at least N games (e.g. `season.gp >= 20`) to avoid small-sample noise.
2. **Glass & Hustle** — columns: Player · Team · OREB · DREB · TOTAL REB · STL+BLK (stocks/g) · TOV. Sorted by total REB default.
3. **Impact** — columns: Player · Team · +/- · FP · V (value) · MP. Sorted by `plus_minus` default; color-code positive (emerald) / negative (destructive).

Each row is clickable → opens existing `<PlayerModal>`. Team logo cell opens `<TeamModal>`. Reuses `usePlayersQuery({ limit: 1000 })` (already cached). Small filter chips above the row of tables: `All / FC / BC` (toggles `core.fc_bc`), and a numeric "min GP" stepper (default 20).

### b) "Trending" tab — last-5 game momentum
Same three-up layout, all driven by `last5` + `computed`:

1. **Hot Hands (FP5 leaders)** — Player · Team · FP5 · FP (season) · Δ (delta_fp) · MP5. Sorted by FP5 desc; Δ shown as colored chip (green = hot, red = cold).
2. **Value Kings (V5 leaders)** — Player · Team · V5 · V (season) · Salary · FP5. Sorted by V5 desc. Highlights the cheapest high-output bench-grade options.
3. **Stocks Surge** — Player · Team · Stocks5 (computed) · Stocks (season) · STL5 · BLK5. Sorted by Stocks5 desc. Useful for DEF-tilt rosters.

Same min-GP filter (defaults to `gp_last5 >= 3` — players who actually played 3 of the last 5). Clicks open Player/Team modals. Header right-side shows "Last 5 Games · updated <time>" pulled from the existing `data?.updatedAt` if available, otherwise current time.

### Files
- `src/pages/AdvancedPage.tsx`
  - Wrap content below `<NBAPlaySearchSection />` in `<Tabs>` with three triggers.
  - Move existing "Playing Time Trends" UI into the `playing-time` `<TabsContent>`.
  - New `<AdvancedStatsTab />` component (in same file or `src/components/advanced/AdvancedStatsTab.tsx`) — three sub-tables, shared `LeaderTable` primitive.
  - New `<TrendingTab />` component (same pattern).
  - One shared `LeaderTable` component (column config in, rows in, click handlers in) to avoid duplication.
- No new edge function needed — all data already shipped via `usePlayersQuery`.
- No DB changes.

---

## Out of scope
- AI-generated blurbs (we use deterministic templates so the line is instant and free).
- Changes to `/schedule` Grid view (cards stay compact).
- Mobile-specific layout changes beyond the existing responsive grid.
- Schema/edge-function changes.
