

## Schedule Page Enhancements

### Overview
Four groups of changes to the `/schedule` page: a "Last Played" navigation button, LIVE game indicator, redesigned expanded box score with embedded recap video, and game card action icons that open an "NBA Game" modal with tabs.

### 1. "LAST PLAYED" Button (SchedulePage.tsx)

- Add a new edge function query or a lightweight Supabase query to find the latest `(gw, day)` with `status = 'FINAL'` games.
- New hook `useLastPlayedDay()` — queries `schedule_games` for `SELECT gw, day FROM schedule_games WHERE status = 'FINAL' ORDER BY gw DESC, day DESC LIMIT 1`.
- Place a button with green background and a `History` (or `CircleCheckBig`) icon, labeled "LAST PLAYED", right before the existing "Today" button in the date header bar.
- Clicking it sets `gw` and `day` to the returned values.

**New file**: `src/hooks/useLastPlayedDay.ts` (calls schedule edge function or a small dedicated query)
**Edit**: `src/pages/SchedulePage.tsx` — add the button

### 2. LIVE Game Indicator (ScheduleList.tsx)

- Update `ScheduleGameSchema` status enum to include `"LIVE"` and `"IN_PROGRESS"`.
- For games with status `LIVE` or `IN_PROGRESS`, show a pulsing red "LIVE" badge before the status badge.
- The "LIVE" badge links to the game's `game_playbyplay_url` (opens in new tab).
- Also update `getStatusBorder` for LIVE styling.

**Edit**: `src/lib/contracts.ts` — relax status enum
**Edit**: `src/components/ScheduleList.tsx` — add LIVE badge with link

### 3. Redesigned Expanded Box Score (ScheduleList.tsx)

- Change the grid layout of `GameBoxScore` so stat columns (FP, MP, PS, A, R, B, S) come right after the player name column (compact), leaving room on the right for a video container.
- New layout: `grid-cols-[minmax(140px,1fr)_repeat(7,32px)_1fr]` — player info + stats on the left, recap video on the right.
- The video container embeds the `game_recap_url` in an `<iframe>` (NBA.com recap URLs are embeddable). Video does NOT autoplay — user must click play.
- Player names use `truncate` with a `max-w` to prevent clipping issues.

### 4. Game Card Action Icons + "NBA Game" Modal

**New component**: `src/components/NBAGameModal.tsx`
- A dialog/modal titled "NBA Game" with 4 tabs: "Game Recap", "Game BoxScore", "Game Charts", "Game Play_By_Play".
- Each tab embeds the corresponding URL in an `<iframe>`.
- The "Game Recap" tab auto-plays when opened from the recap icon.
- Accepts props: `game`, `defaultTab`, `open`, `onOpenChange`, `autoPlay`.

**Edit**: `src/components/ScheduleList.tsx` — On each game card row, add 4 clickable icons (right side, before the chevron):
- **TV icon** (`Tv2` from lucide) → opens modal on "Game Recap" tab (autoplay)
- **Scoreboard icon** (`LayoutGrid` or `Table2`) → opens modal on "Game BoxScore" tab
- **Chart icon** (`BarChart3`) → opens modal on "Game Charts" tab
- **Microphone icon** (`Mic`) → opens modal on "Game Play_By_Play" tab

Each icon only renders if the corresponding URL exists on the game object.

### Files changed

| File | Action |
|------|--------|
| `src/hooks/useLastPlayedDay.ts` | New — query for last day with FINAL games |
| `src/components/NBAGameModal.tsx` | New — tabbed modal with iframe embeds |
| `src/pages/SchedulePage.tsx` | Add "LAST PLAYED" button |
| `src/components/ScheduleList.tsx` | LIVE badge, redesigned box score layout with video, game card action icons |
| `src/lib/contracts.ts` | Add LIVE/IN_PROGRESS to status enum |
| `supabase/functions/schedule/index.ts` | Pass through LIVE status without normalizing to FINAL |

