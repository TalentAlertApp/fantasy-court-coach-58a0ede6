

## Plan: Premium Explain UI, NBA.com recaps, and NBA Play Search

### 1. AI Coach → Explain: premium UI redesign
File: `src/components/AICoachModal.tsx` (Explain `TabsContent` block, lines ~330-454)

The current explanation is a wall of bold paragraph + flat factor rows + a tiny recommendation chip. Redesign as a structured "scouting report" card:

- **Player header card** (shown above results when a player is selected):
  - Left: rounded photo `w-14 h-14` + faded team-logo watermark behind it.
  - Middle: player name (heading), team full name + tricode + FC/BC badge.
  - Right: large `FP5` value, smaller `Season FP` underneath, both tabular.
  - Subtle gradient background (`bg-gradient-to-r from-card via-muted/30 to-card`), `rounded-xl border`.

- **Summary block**:
  - Section label `EXPLANATION FOR <NAME>` (kept), then summary in a quoted card: `border-l-4 border-accent pl-3 py-1 italic text-sm` so it reads like an analyst's verdict.

- **"Why it scores" — factor grid**:
  - Replace the flat row layout with a 1-column stack of factor "rows" inside a `border rounded-xl divide-y` container.
  - Each row: `[icon for factor] [factor label, uppercase] [impact pill, color-coded] — [note text]`.
  - Impact color mapping (Tailwind classes only, no new tokens):
    - `very_high` → solid `bg-emerald-500 text-white`
    - `high` → `bg-emerald-500/20 text-emerald-300 border border-emerald-500/40`
    - `medium` → `bg-amber-500/20 text-amber-300 border border-amber-500/40`
    - `low` → `bg-muted text-muted-foreground border`
  - Factor icons via lucide (e.g. `rebounds → Disc`, `assists → Users`, `stocks/blocks → Shield`, `minutes → Clock`, `usage → Activity`, fallback → `Sparkles`).
  - The note sits on its own line below the factor+impact header at `text-xs text-muted-foreground`.

- **Recommendation banner** (bottom):
  - Full-width pill: large action chip (`HOLD` / `ADD` / `DROP`) styled per action color (green/red/amber), with rationale text on the right.
  - Wrap inside a card with `bg-gradient-to-r` matching the action sentiment.

- **Loading state**: replace the lone `Skeleton` with three stacked skeletons (`h-16` header, `h-10` summary, `h-24` factors) for a better perceived load.

- All other Explain logic (search, popover, recents, recently-explained chips) stays unchanged.

### 2. `/schedule` Game Recaps — switch from YouTube embed to official NBA.com recap
Files: `src/components/ScheduleList.tsx`, `src/components/TeamModal.tsx`, `src/components/PlayerModal.tsx`

Every FINAL game already stores `game_recap_url` like `https://www.nba.com/game/orl-vs-por-0022500420?watchRecap=true` (verified in DB). NBA.com auto-opens the recap player when `?watchRecap=true` is present, perfect for League Pass users. We'll route the "Watch Recap" experience through this URL and stop relying on the unreliable YouTube auto-search.

#### 2a. `ScheduleList.tsx`
- Replace the in-card iframe + `youtube_recap_id` toggle with a single **"Watch Recap"** button-link:
  ```tsx
  {game.game_recap_url && (
    <a href={game.game_recap_url} target="_blank" rel="noreferrer"
       className="inline-flex items-center gap-1.5 text-xs text-green-500 hover:text-green-400 px-3 py-1.5 rounded-xl border border-green-500/40">
      <Tv2 className="h-3.5 w-3.5" /> Watch Recap on NBA.com <ExternalLink className="h-3 w-3" />
    </a>
  )}
  ```
- Remove the `showRecap` state, the inline iframe block, and the `youtube_recap_id` rendering branch (still keep the `youtube_recap_id` prop on the type so other components keep compiling). Drives users straight to the official recap — no more wrong-game embeds.

#### 2b. `TeamModal.tsx` and `PlayerModal.tsx`
- Replace the current `Tv2` button that depended on `youtube_recap_id` with an `<a>` that opens `g.game_recap_url` (or `h.game_recap_url`) in a new tab. Disabled/grayed if `game_recap_url` is null.
- Drop the inline YouTube iframe expansion in `TeamModal`.

#### 2c. Improve the "Populate Recaps" flow on `/commissioner` (kept as fallback)
File: `supabase/functions/youtube-recap-lookup/index.ts`

Even though the schedule UI now uses NBA.com URLs, keep the YouTube job for legacy mini-thumbnails but make its results dramatically more accurate:

- Build the search query from **actual matchup metadata** with the date so the right game wins:
  ```ts
  const dateStr = game.date ? new Date(game.date).toISOString().slice(0, 10) : "";
  const awayFull = TEAM_FULL_NAME[game.away_team];
  const homeFull = TEAM_FULL_NAME[game.home_team];
  const query = `${awayFull} vs ${homeFull} game recap ${dateStr}`;
  ```
- Add an inline `TEAM_FULL_NAME` map (30 tricodes → full names) inside the function.
- Select the response to also fetch `date, home_team, away_team`.
- Request `maxResults=5` and pick the first item whose `snippet.title` (lowercased) contains both team city names AND the words "recap" or "highlights" — fall back to the first item only if none match.
- Add `videoEmbeddable=true&type=video` and `order=relevance` to the YouTube call.
- Result: dramatically reduces wrong-game / wrong-context videos for any feature still using `youtube_recap_id`.

### 3. `/advanced` — new "NBA Play Search" section
File: `src/pages/AdvancedPage.tsx` (insert ABOVE the existing "Playing Time Trends" header)

Add a self-contained section using the existing project styling. No new files, no routes.

- Wrap in the same surface treatment used by the Trends table: `border border-border rounded-lg overflow-hidden`. Header bar styled like the existing `bg-muted/40` strip with icon + label `NBA PLAY SEARCH` + small subtitle `Search play-by-play clips on NBAPlayDB — results open in a new tab` + an `ExternalLink` icon.
- Body (`p-4 space-y-4`) contains a `<Tabs defaultValue="player">` with two triggers:
  - `🔍 By Player / Play`
  - `🏀 By Game`

#### 3a. Tab "By Player / Play"
Three fields in a responsive grid (`grid sm:grid-cols-3 gap-3`):
- Player name — shadcn `Input`, placeholder `"e.g. Nikola Jokić"`.
- Play type — shadcn `Select` with options exactly as specified (`""`, `dunk`, `3pt`, `assist`, `rebound`, `block`, `steal`, `turnover`, `foul`, `freethrow`).
- Team — `Input`, placeholder `"e.g. Denver Nuggets"`.

Compose `q = [player, playType, team].filter(Boolean).join(" ").trim()`.
Primary `Button` "Open on NBAPlayDB ↗":
- Disabled when `!player.trim() && !playType` (per spec: at least one of player or play type).
- `onClick = () => window.open("https://www.nbaplaydb.com/search?q=" + encodeURIComponent(q), "_blank", "noopener,noreferrer")`.

#### 3b. Tab "By Game"
Three fields in `grid sm:grid-cols-3 gap-3`:
- Game date — `<Input type="date">` defaulting to today (`new Date().toISOString().slice(0,10)`).
- Away team — shadcn `Select` with the 30-team list (sorted alphabetically by city full name; value = abbrev).
- Home team — same `Select`.

Build `yyyymmdd = date.replaceAll("-", "")` and `gamecode = ${yyyymmdd}/${away}${home}`.
Two buttons in a row:
- Primary "Open on NBAPlayDB ↗": opens `https://www.nbaplaydb.com/search?gamecode=${encodeURIComponent(gamecode)}`.
- Ghost "View Game Page ↗": opens `https://www.nbaplaydb.com/games/${yyyymmdd}-${away}${home}`.
- Both disabled until `date && away && home` are all set.

All state is `useState` local. No Supabase, no edge functions, no new files. Existing imports cover everything except `Card`/`CardHeader`/`CardContent` (already in `src/components/ui/card.tsx`), `Tabs`/triggers, `Input`, `Label`, `Select`, `Button`, `ExternalLink`, `Search` from lucide.

### Files touched
- `src/components/AICoachModal.tsx` — redesign Explain results: player header card, quoted summary, factor grid with color-coded impact pills + factor icons, action banner.
- `src/components/ScheduleList.tsx` — replace YouTube iframe recap with a "Watch Recap on NBA.com" link using `game_recap_url`.
- `src/components/TeamModal.tsx` — same: recap button now opens `game_recap_url` in a new tab; remove inline iframe block.
- `src/components/PlayerModal.tsx` — recap icon turns into a link to `game_recap_url`; greyed when null.
- `supabase/functions/youtube-recap-lookup/index.ts` — query the right matchup with full team names + date, score titles by city/team match, pick best video instead of blind first hit.
- `src/pages/AdvancedPage.tsx` — add the new "NBA Play Search" section above Playing Time Trends, with two tabs and external-link buttons.

### Verification
- AI Coach → Explain → pick "Neemias Queta": result now shows a player header card (photo + team logo watermark + FP5 number), an italic verdict block, factor rows with green/amber color-coded impact pills and factor icons, and a colored HOLD banner — matches the screenshot's intent at a premium polish level.
- `/schedule` → click any FINAL game card → "Watch Recap" link opens the official NBA.com recap (auto-plays for League Pass users) instead of an embedded YouTube video. No more wrong-game clips.
- `/commissioner` → "Populate YouTube Recaps" still runs; videos found use the full-name + date query and pick the best-matching title.
- `/advanced` page now has a "NBA Play Search" card above Playing Time Trends with the two tabs; selecting fields and clicking the buttons opens the correct `nbaplaydb.com` URLs in a new tab; buttons stay disabled until required fields are filled.

