## 1) `src/components/schedule/GameRecapsModal.tsx`

**Light-theme readability & premium feel**
- Selector chips ("GAMEDAY", "GAME") and the right-side "N RECAPS" pill: switch label color to white in both themes (`text-white` instead of `text-amber-50 dark:text-muted-foreground`), keep stone-900 background so contrast holds.
- Team-table containers: drop the heavy `bg-stone-950/85` in light theme — use `bg-background/95 dark:bg-background/70` with `border-amber-400/30` and remove any overriding text colors so the table renders with its own foreground tokens (readable + premium in both themes).
- Ballers.IQ LIVE toggle button: rebuild to match the other selector chips visually — `h-9` pill, gradient amber background when `on`, neutral stone-900/40 + amber border when off, white text, subtle Sparkles. Remove the awkward inline wordmark sizing and the separate "Live" suffix; show the BallersIQBrand wordmark only, with a tiny pulsing dot when active. Keep behavior identical.

**Watermark (top-right)**
- Remove the small `<img>` league logo from the top hero row.
- Add a large absolute-positioned watermark inside the modal hero area: `absolute -top-4 -right-6 h-44 w-44 object-contain opacity-[0.10] rotate-[8deg] pointer-events-none select-none`, with a soft hover-free premium tilt and a thin radial mask for depth.

**Empty state (light theme background)**
- Replace the dark `bg-black/55` overlay in light mode with a warm wood-tone wash (`bg-[hsl(28_55%_18%/0.55)] dark:bg-black/70`) so the surrounding modal background blends with the court placeholder.
- Slightly raise the modal base in light mode to a richer parquet hue (`bg-[radial-gradient(ellipse_at_top,hsl(30_55%_24%/0.6),hsl(25_42%_15%)_72%)]`) so the empty-state court reads as a continuation of the floor.

**Bottom card content**
- Remove the `railBlurb` (the `Toronto Tempo 111 @ 104 Chicago Sky · United Center` line) — pass `blurb={undefined}` always.
- The rail will then show only the GameActionLinks icons centered in the middle (no surrounding text/separators); see rail changes below.

## 2) `src/components/schedule/GameTeamsFormRail.tsx`

- When a game is selected: keep the left/right TeamRow blocks. The center now renders just the `actions` (4 icons) centered with `flex-1 flex justify-center` — no sentence, no `|` separators around the icons.
- When no game is selected: render only the centered hint sentence ("Pick a game to see each team's recent and upcoming matchups") in bold white.
- `Circle` component:
  - Remove the background container (`bg-background/80 dark:bg-background/70`) and the colored border ring. Render the opponent badge "naturally" — just the `<img>` at `w-7 h-7 object-contain`, with the surge/hover scale + amber glow preserved.
  - Wrap each circle in a `<button>` (or `<a>`) that triggers a callback when clicked. Add new optional props to the rail:
    - `onSelectPlayedGame?: (gameId: string) => void`
    - `onSelectScheduledGame?: (game: { game_id, home_team, away_team, tipoff_utc, status }) => void`
  - For played slots with a recap (treat `slot.played === true` as eligible since the parent already filters), call `onSelectPlayedGame(slot.gameId)`.
  - For non-played slots, call `onSelectScheduledGame` with the slot data.

- Extend `TeamGameSlot` in `src/hooks/useTeamRecentUpcoming.ts` so the slot carries the minimum fields needed to open `GameDetailModal`: `homeTeam`, `awayTeam`, `youtubeRecapId?`, `gameRecapUrl?`. Add `game_recap_url` and `youtube_recap_id` to the `baseSelect` so the rail can detect whether a recap exists.

## 3) Wiring in `GameRecapsModal.tsx`

- Pass `onSelectPlayedGame={(id) => setSelectedGameId(id)}` to the rail. The game must belong to the current gameday; if the clicked played game's gameday differs, find the matching gw/day from `weekGames` (or refetch via `useScheduleWeekGames` of that gw) — for simplicity, only allow direct selection if the game is in `playedGames` for the current view; otherwise update `gw`/`day` via a lookup against `deadlines` using `tipoff_utc` and then set the id.
- Add local state `scheduledDetail: GameDetailGame | null` and pass `onSelectScheduledGame` to set it. Render `<GameDetailModal game={scheduledDetail} open={!!scheduledDetail} onOpenChange={(o) => !o && setScheduledDetail(null)} />` inside the modal (nested dialogs are supported by Radix).

## 4) `src/pages/SchedulePage.tsx`

- Remove the `selectedDateLabel`, `Day {day}`, `TODAY` badge, deadline clock+time, the dot separators, the view-mode toggle, injury button, and grid button **from the center/left of the date-header row's current layout**, and restructure as follows on the date header row (`px-1 py-3 bg-background` block):
  - LEFT cluster (new far-left position): deadline (clock + time), then the list/grid view toggle, then the Bandage (injury) icon button, then the Grid3X3 (advanced schedule grid) button. All retain current handlers/titles.
  - Remove the `<h3>{selectedDateLabel}</h3>`, the `Day {day}` chip, and the `TODAY` badge entirely.
  - CENTER cluster (Game Recaps | Team of the Week | Players of the Day | Daily Court Show) stays as-is.
  - RIGHT cluster (Last Played / Today) stays as-is.

No other behavior changes on this page.

## Out of scope
- No backend/data changes beyond adding two existing columns to the `useTeamRecentUpcoming` select.
- No changes to `GameBoxScoreTable`, `GameBallersIQSidePanel`, `GameActionLinks`, or `GameDetailModal`.
- No design system token changes; only consume existing tokens.
