

## Fix Plan: 5 Issues

### Root Cause for Issues 4a and 5
The `PlayerSeasonSchema` in `contracts.ts` uses `.strict()` but the `players-list` edge function now returns extra `total_*` fields (`total_mp`, `total_pts`, `total_reb`, `total_ast`, `total_stl`, `total_blk`, `total_fp`). Zod strict mode rejects unknown keys, causing the entire API response to fail silently. This breaks both `/players` (empty page) and the Add Player picker on the dashboard (no players found).

### Changes

**1. Video container width (`src/components/ScheduleList.tsx`)**
- Increase video container from `w-[480px]` to `w-[640px]` to fill more of the card width and reduce/eliminate black bars above/below the 16:9 video content

**2. TeamModal improvements (`src/components/TeamModal.tsx`)**
- **Roster tab**: Add a header row with MPG, PPG, FP, $ columns. Add sort state; clicking a header sorts the roster by that metric. Active sort header shown in bold (no arrows)
- **Played tab**: Wire each game row to open the game on `/schedule` within the app (navigate to `/schedule?gw=X&day=Y` or use `window.open` to the `nba_game_url`). Since there's no in-app game detail route, link to the `nba_game_url` externally

**3. Teams page hover effects (`src/pages/TeamsPage.tsx`)**
- Add a team primary color map (30 hex colors keyed by tricode) to `nba-teams.ts`
- Apply `border-2` with the team's primary color on each card
- On hover: increase border opacity/brightness and scale up the team badge with `hover:scale-110 transition-transform`

**4. Fix Players page + Add Player picker (`src/lib/contracts.ts`)**
- Add `total_mp`, `total_pts`, `total_reb`, `total_ast`, `total_stl`, `total_blk`, `total_fp` fields to `PlayerSeasonSchema`
- This single fix resolves: empty `/players` page, empty Performance tab, broken FP5/Value5, and empty Add Player picker on dashboard

**4b. Max Salary slider (`src/components/FiltersPanel.tsx`)**
- Change the slider `max` from hardcoded `50` to accept a prop `maxSalaryLimit` defaulting to `50`
- In `PlayersPage.tsx`, compute `maxSalaryLimit` from the data: `Math.ceil(Math.max(...items.map(p => p.core.salary)))` and pass it down
- Set initial `maxSalary` state to that computed max (or keep at current value if data not loaded yet)

### Files to Edit

| File | Change |
|------|--------|
| `src/lib/contracts.ts` | Add 7 `total_*` fields to `PlayerSeasonSchema` |
| `src/components/ScheduleList.tsx` | Change `w-[480px]` to `w-[640px]` |
| `src/components/TeamModal.tsx` | Add roster sort headers (MPG/PPG/FP/$); wire played games to URLs |
| `src/pages/TeamsPage.tsx` | Add team color border + hover scale on badge |
| `src/lib/nba-teams.ts` | Add `primaryColor` field to `NbaTeam` interface and all 30 teams |
| `src/components/FiltersPanel.tsx` | Accept `maxSalaryLimit` prop, use as slider max |
| `src/pages/PlayersPage.tsx` | Compute and pass `maxSalaryLimit` from data; set initial `maxSalary` to max |

### Implementation Order
1. Fix `contracts.ts` (unblocks everything)
2. ScheduleList video width
3. TeamModal sort + game links
4. TeamsPage colors + hover
5. FiltersPanel max salary

