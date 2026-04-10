

## Fix Player Names, Widen Video, Auto-Populate YouTube Recaps

### 1. Player names at full length
Remove `max-w-[100px]` and `truncate` from player name span in `ScheduleList.tsx`. The `minmax(90px,1fr)` column already flexes — the name will use all available space.

### 2. Wider video container in 16:9
- Change recap container from `w-[420px]` to `w-[500px]`
- Replace `min-h-[220px]` on the iframe with `aspect-video` (Tailwind's 16:9 aspect ratio class), so the video fills the container without black bars
- The iframe gets `w-full` and the aspect ratio handles height automatically

### 3. Auto-populate YouTube recap IDs for all games
Create a new Edge Function `youtube-recap-lookup` that:
- Queries `schedule_games` for all FINAL games where `youtube_recap_id IS NULL`
- For each game, calls the YouTube Data API (`search.list`) searching for `"Motion Station" {away_team} vs {home_team} recap` (the channel that publishes all NBA recaps)
- Takes the first result's video ID and updates `youtube_recap_id` in `schedule_games`
- Processes in batches to respect API quotas
- Requires a `YOUTUBE_API_KEY` secret in Supabase

Also add a button on the Commissioner page to trigger this function, and wire it so it can be called manually or on a schedule.

### Files changed

| File | Change |
|------|--------|
| `src/components/ScheduleList.tsx` | Remove name truncation; widen container to 500px; use `aspect-video` on iframe |
| `supabase/functions/youtube-recap-lookup/index.ts` | New — batch YouTube search + update `schedule_games` |
| `src/pages/CommissionerPage.tsx` | Add "Populate YouTube Recaps" button |

### Technical detail

**YouTube Data API search call:**
```
GET https://www.googleapis.com/youtube/v3/search
  ?part=snippet
  &q=Motion+Station+{away}+vs+{home}+recap
  &type=video
  &maxResults=1
  &key={YOUTUBE_API_KEY}
```
Response gives `items[0].id.videoId` → stored as `youtube_recap_id`.

The free YouTube API quota is 10,000 units/day; each search costs 100 units = ~100 games/day. For a full season (~1,200 games) this takes ~12 days of daily runs, or we can request a quota increase. The function will process what it can per invocation and skip already-populated games.

