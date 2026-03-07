

## Plan: Fix Day Navigation + Add Expandable Game Box Scores

### 1. Fix Day Navigation (`src/pages/SchedulePage.tsx`)

Replace the current asymmetric Week/Day controls with a single Day-centric navigation:
- **Left arrow**: `changeDay(-1)` — decrease day by 1, wrap to previous week's last day if at day 1
- **Right arrow**: `changeDay(+1)` — increase day by 1, wrap to next week's day 1 if at max day
- Week label updates automatically based on current day position — no separate week arrows
- Keep the "Today" button and date label as-is

### 2. Expandable Game Box Scores

#### New edge function: `supabase/functions/game-boxscore/index.ts`
- Accepts `?game_id=22500879`
- Queries `player_game_logs` joined with `players` for that game_id
- Returns player stats: `player_id`, `name`, `fc_bc`, `photo`, `pts` (points scored), `mp`, `fp` (fantasy points), `reb`, `ast`, `blk`, `stl`
- Sorted by `fp` descending

#### New contract in `src/lib/contracts.ts`
- `GameBoxscorePlayerSchema`: player_id, name, fc_bc, photo, mp, ps (points scored), fp (PTS/fantasy points), reb, ast, blk, stl
- `GameBoxscorePayloadSchema`: game_id, players array
- `GameBoxscoreResponseSchema`: envelope wrapper

#### New API function in `src/lib/api.ts`
- `fetchGameBoxscore(gameId: string)` calling the new edge function

#### New hook: `src/hooks/useGameBoxscoreQuery.ts`
- React Query hook wrapping `fetchGameBoxscore`, enabled only when game is expanded

#### Updated `src/components/ScheduleList.tsx`
- Track expanded game_id(s) in local state
- For FINAL games, clicking the row toggles expansion
- Expanded section uses Collapsible component, fetches box score on open
- Displays a compact table/grid per player:
  - Player photo (small avatar), FC/BC badge, player name
  - Columns: PTS (fantasy points), MP, PS (points scored), A, R, B, S
  - Rows grouped or sorted by team (away then home)

### Files to Create/Modify

| File | Action |
|---|---|
| `supabase/functions/game-boxscore/index.ts` | Create — new edge function |
| `src/lib/contracts.ts` | Add box score schemas |
| `src/lib/api.ts` | Add `fetchGameBoxscore` |
| `src/hooks/useGameBoxscoreQuery.ts` | Create — React Query hook |
| `src/components/ScheduleList.tsx` | Add expandable rows with player stats |
| `src/pages/SchedulePage.tsx` | Fix navigation to left/right day arrows only |

