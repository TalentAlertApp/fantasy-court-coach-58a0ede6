

## Plan: Cinematic Roster Display + New Scoring Page

### Part 1: Cinematic Starting 5 on Roster Page

**Inspired by the reference image**: Make player cards on the court much larger and more cinematic — big player photos without card containers, names and stats overlaid directly on/below the photo.

**Files: `src/components/PlayerCard.tsx`, `src/components/RosterCourtView.tsx`**

- **PlayerCard court variant overhaul**: Replace the current small card with a cinematic layout:
  - Player photo enlarged to `w-24 h-24` (from `w-16 h-16`), no card background — transparent/minimal
  - Name displayed larger (`text-base font-bold`) below photo
  - FC/BC badge, salary, V5 overlaid compactly
  - Remove the bordered card look; use a subtle dark gradient overlay instead
  - Keep the 6 upcoming opponent slots but make them slightly larger
  - Team logo as subtle watermark behind the player

- **RosterCourtView**: Increase player slot widths from `w-[18%]` to `w-[20%]` to accommodate bigger cards. The court background remains.

### Part 2: New Scoring Page

**New file: `src/pages/ScoringPage.tsx`**

This page fetches game logs for the current roster's 10 players across all weeks and displays scoring history. Since the roster table only stores the current snapshot (no historical roster records), the page will compute stats for the **current 10 players** across all past game days.

**Data source**: Edge function `scoring-history` that:
1. Takes `team_id` as param
2. Reads current roster (10 player IDs)
3. Joins `player_game_logs` with `schedule_games` (via `game_date = tipoff_utc::date`) to get GW/day mapping
4. Returns per-game-day rows: `{ gw, day, game_date, players: [{ player_id, name, team, fc_bc, photo, opp, home_away, result_wl, fp, salary, value, mp, pts (real pts), ast, reb, blk, stl, nba_game_url }] }`
5. Also returns weekly aggregates: `{ gw, total_fp, best_player, worst_player }`

**New file: `supabase/functions/scoring-history/index.ts`**

**UI Layout** (3 sections):

**A) Weekly Leaderboard Table** (top)
- Columns: Week | Total FP | Best Player | Worst Player | Captain Bonus
- Highlight current week row
- Running season total at the bottom
- Premium styling with alternating rows

**B) Timeline Chart** (middle)
- Dot chart showing total FP per game day (X = game day, Y = FP)
- Highlight dots where roster replacements occurred (different color)
- Clicking a dot selects that game day and scrolls to the roster table below
- Show the Starting 5 selected for that day in a mini visual

**C) Game Day Roster Table** (bottom)
- Navigation arrows in header: `< GW25 Day 3 >`
- 10 player rows with:
  - FC/BC badge (red/blue color scheme)
  - Player photo (circular, surge on hover)
  - Player name (bold, larger font)
  - Team badge watermark (large, far right, surge on hover)
  - Opp team badge (large, with `@` prefix if away)
  - Result (W/L) — linked to Game URL (external tab)
  - Stat columns: FP, $, V, MP, PS, A, R, B, S
- Opp team badge wired to TeamModal
- Result wired to `nba_game_url` (opens new tab)

**New file: `src/hooks/useScoringHistory.ts`** — React Query hook for the edge function

**Navigation**: Add to sidebar in `AppLayout.tsx` after "My Roster":
- Icon: `Trophy` (from lucide-react) — represents scoring/performance
- Label: "Scoring"
- Route: `/scoring`

**Route**: Add in `App.tsx`: `<Route path="/scoring" element={<ScoringPage />} />`

### Files Summary

| File | Changes |
|------|---------|
| `src/components/PlayerCard.tsx` | Cinematic court variant with bigger photos, overlay stats |
| `src/components/RosterCourtView.tsx` | Wider player slots for cinematic cards |
| `src/pages/ScoringPage.tsx` | **New** — full Scoring page with leaderboard, timeline, roster table |
| `src/hooks/useScoringHistory.ts` | **New** — React Query hook |
| `supabase/functions/scoring-history/index.ts` | **New** — edge function for scoring data |
| `src/components/layout/AppLayout.tsx` | Add Scoring nav item |
| `src/App.tsx` | Add `/scoring` route |

### Technical Notes

- The edge function joins `player_game_logs` with `schedule_games` to map dates to GW/day
- Since no historical roster snapshots exist, scoring is computed retroactively for the current 10 players
- The timeline uses Recharts (already in the project) for the dot chart
- TeamModal and external game URLs are wired from the roster table

