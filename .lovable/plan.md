

## Plan: Injury modal scroll height + AI Transfers rules-aware + Schedule standings/last-5 fix

### 1. Injury Report Modal — keep ALL-tab vertical height for every team view
File: `src/components/InjuryReportModal.tsx`

Current bug: when a team is picked from the dropdown, the list height collapses because the outer `DialogContent` plus `min-h-0` chain shrinks to fit a few rows.

Fix:
- Force a stable min-height on the scroll container so it always reserves the same vertical area as the ALL view, regardless of how few rows the team has.
- Replace the list wrapper class with `flex-1 min-h-[60vh] sm:min-h-[60vh] overflow-y-auto overscroll-contain px-3 pb-4 pt-2 relative`.
- Also set `DialogContent` desktop sizing to `sm:max-w-3xl sm:h-[80vh] sm:max-h-[80vh]` (was `sm:h-auto sm:max-h-[85vh]`) so the modal box itself is fixed height — this is what makes the inner area constant whether the visible list has 3 rows or 100.
- Mobile already uses `w-screen h-screen`, so no change there.

This guarantees the team-tab view has the same vertical space and scrolling behaviour as ALL.

### 2. AI Coach → TRANSFERS: respect ALL game rules ($100M cap, max 2/team, FC/BC, etc.)
Files: `supabase/functions/ai-coach/index.ts`, `src/components/AICoachModal.tsx`

The current AI advice violates the game rules (screenshot shows ADD Dončić / DROP Raynaud which would blow past the $100M cap). Root causes:
- `fetchContext` pulls roster + 200 players but never reads `team_settings` (salary cap / FC-BC mins) and never computes current roster salary or bank_remaining.
- The prompt mentions `salary_cap` and `bank_remaining` as constraints but the payload doesn't include them.
- The "max 2 players per NBA team" rule from "How to Play" is never declared to the model anywhere.

Fixes (server-side, in `supabase/functions/ai-coach/index.ts`):
- Extend `fetchContext` to also `select` from `team_settings` for the resolved `team_id`. Default to `{ salary_cap: 100, starter_fc_min: 2, starter_bc_min: 2 }` if no row exists.
- Compute and inject into the dev message:
  - `roster_salary_total` = sum of `players.salary` for all 10 roster players of the active team.
  - `bank_remaining` = `salary_cap - roster_salary_total`.
  - `team_distribution` = a `{ tricode: count }` map of how many roster players belong to each NBA team.
- Add an explicit `HARD CONSTRAINTS` block to the system prompt covering the immutable game rules:
  - Roster size = 10 (5 starters + 5 bench).
  - 5 FC + 5 BC total.
  - Starting 5 must contain ≥2 FC and ≥2 BC.
  - Salary cap = `$100M` (use the value from `team_settings.salary_cap`); after any proposed swap the new total salary MUST be ≤ cap.
  - Maximum 2 players from the same NBA team across the full 10-man roster — every proposed ADD must respect this AFTER the corresponding DROP is applied.
  - 1 captain per gameweek = 2× FP.
- Update the `suggest-transfers` schema description to require the model to:
  - Only return moves where post-swap `total_salary ≤ salary_cap`.
  - Only return moves where the ADD player's NBA team count (after the swap) ≤ 2.
  - Maintain the FC/BC totals (5/5) — i.e. ADD and DROP must share the same `fc_bc`.
  - Include a `cap_after` numeric field per move so the UI can verify.
- Server-side post-validation step (defence-in-depth) for `suggest-transfers`: after the AI returns moves, drop any move that violates cap, team-cap, or FC/BC parity. If all are dropped, return an empty `moves` array with a `notes` entry explaining which constraint failed.

Client-side (`src/components/AICoachModal.tsx`):
- `handleTransfers` currently sends `max_cost: rosterData?.roster?.bank_remaining ?? 100`. Keep this but also rely on the server enrichment. No additional UI work needed — the existing `Simulate` button already validates moves against the real backend before commit, so once the model output is constraint-clean it stays clean.

### 3. `/schedule` — fix team standings (full conference data) + relocate Last 5 Games + only Recap link
File: `src/components/ScheduleList.tsx`

Bug today: `useTeamFormData` is called with only the 2 game teams, so `result` only contains W/L for those 2 teams. `computeConfStandings` then iterates the whole conference but reads `data[t]` which is `undefined` for the other 13 teams — that's why every other team in the standings table shows `0-0 / .000`.

Fix:
- Replace the per-game-team query with a conference-aware query. Two clean options; we'll take the simple one:
  - Add a new internal hook (still inside `ScheduleList.tsx`) `useAllTeamsForm()` that fetches `schedule_games` once (final games only) and returns `Record<tricode, TeamFormData>` for all 30 teams. Cache via React Query with `staleTime: 60_000` and a stable key `["all-teams-form"]`.
  - `UpcomingGamePreview` now consumes this hook (instead of `useTeamFormData([away, home])`). All 30 teams get real W/L, so `computeConfStandings` produces the correct rank, GP, W, L, PCT, GB for every row.
- Confirm the existing 5-row windowing in `computeConfStandings` already yields "2 above + the team + 2 below, adjusted at the edges" — it does (`start = max(0, idx - 2)` then clamped near the bottom). Keep as is.
- Layout change inside `UpcomingGamePreview`:
  - Restructure each team column to a 2-column inner grid: `[Conference standings (left)] [Last 5 Games (right)]` so Last 5 sits next to the standings instead of below them. Use `grid grid-cols-1 md:grid-cols-2 gap-3` for that inner pair so on narrow viewports it stacks.
  - Keep the team header (logo + tricode + conference) and the W-L / PCT / HOME / AWAY mini stat strip above the two-column block.
- "Last 5 Games" row cleanup:
  - Inside the `team.last5.map(...)` block, remove the BoxScore (`Table2`), Charts (`BarChart3`) and Play-by-Play (`Mic`) icon links. Keep only the Recap icon (`Tv2`), and make it an actual `<a>` to `g.youtube_recap_id` (open `https://www.youtube.com/watch?v=<id>` in a new tab) when present, otherwise dim/disabled. Drop the `g.game_boxscore_url`/`g.game_charts_url`/`g.game_playbyplay_url` blocks entirely.

### Files touched
- `src/components/InjuryReportModal.tsx` (heights only)
- `supabase/functions/ai-coach/index.ts` (context enrichment, prompt rules, post-validate)
- `src/components/ScheduleList.tsx` (standings hook swap, layout regroup, link pruning)

### Verification
- Open AI Coach → Injuries → Scan Injuries; switch from ALL to a team in the dropdown — the player list area keeps the same vertical height and scrolls smoothly.
- Open AI Coach → Transfers → Suggest Transfers; every returned move keeps the post-swap roster within $100M, never proposes a 3rd player from a single NBA team, and matches FC↔FC / BC↔BC. Simulate continues to confirm validity.
- Go to `/schedule`, expand a SCHEDULED game; both team standings tables now show real W/L/PCT/GB for the 5 ranked rows (the game's team is highlighted with 2 above + 2 below where possible). The "Last 5 Games" block is rendered to the right of the standings, and each row only shows the Recap (Tv2) icon.

