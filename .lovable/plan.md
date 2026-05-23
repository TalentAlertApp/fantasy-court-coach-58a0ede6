# Plan

## 1) EuroLeague — bulk-import all YT recaps from `GameRecaps_YT.csv`

CSV contains **380** `Game ID → YouTube URL` mappings. Game IDs (`E2025_…`) match `schedule_games.game_id` for `league_id = 00000000-0000-0000-0000-000000000003`.

**One-shot SQL data update** (no edge function, no API quota, runs once):
- Parse the CSV in `/tmp`, extract the 11-char video id from each URL (handles `watch?v=…`, `youtu.be/…`, `&t=…` suffixes).
- Use the Supabase insert/update tool to run a single `UPDATE schedule_games SET youtube_recap_id = v.yt FROM (VALUES (...380 rows...)) AS v(gid, yt) WHERE schedule_games.game_id = v.gid AND schedule_games.league_id = '00000000-0000-0000-0000-000000000003'`.
- After running, EuroLeague Missing Recaps drops to ~0.

What stays as-is:
- `MissingRecapsPanel` at `/commissioner` keeps working for any future games (still calls `youtube-recap-lookup` with key rotation).
- No edge-function or frontend changes for part 1.

## 2) `/teams` Teams tab — A→Z sort toggle

In `src/pages/TeamsPage.tsx`:
- Add `sortMode: "winpct" | "alpha"` state, default `"winpct"` (current behavior).
- In the `teams` memo, sort by win% when `winpct`, else by `t.name.localeCompare(...)`.
- Add an icon-only button on the right side of the Teams/Standings header row (shown only when `tab === "teams"`), no container/background, `text-muted-foreground hover:text-foreground` (no AI colors):
  - `ArrowDownWideNarrow` (lucide) when in `winpct` mode — clicking switches to A→Z.
  - `ArrowDownAZ` when in `alpha` mode — clicking switches back to Win%.
  - `title`/`aria-label` reflects the next action.

No other UI/logic changes.

## 3) EuroLeague Injury Report — NOT in this plan

The 11 RotoWire / Euroleague.net sources you listed (injury report, injury news, daily lineups, depth charts, minutes report, playing-time changes, official news/players/teams/game-center, fantasy challenge) are a separate, larger workstream — scraping strategy, schema, surfacing in the UI, and refresh cadence all need their own design pass. I'll tackle it in a dedicated follow-up plan after this one ships; please confirm which of those sources are highest priority (e.g. Injury Report + Daily Lineups first?) so I can scope it properly.

## Out of scope (this plan)
- No changes to `youtube-recap-lookup`, `euroleague-recap-scrape`, key rotation, NBA/WNBA flows.
- No injury-report scraping work — see section 3.
