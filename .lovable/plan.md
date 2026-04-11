

## Plan: Standings Tab in /teams + Salary & Value Columns in Box Score

### 1. Standings Tab inside TeamsPage

**File:** `src/pages/TeamsPage.tsx`

Add a tab bar at the top with two tabs: "Teams" (current grid view) and "Standings". The Standings tab renders a `<StandingsPanel />`.

**New files:**

- `src/types/standings.ts` — `StandingRow` type with fields: tricode, name, logo, primaryColor, gp, w, l, pct, gb, homeW, homeL, awayW, awayL, confW, confL, divW, divL, ppg, oppPpg, diff, l10W, l10L, strk, conference, division
- `src/data/nbaTeamsFallback.ts` — Static mapping of all 30 teams to their conference/division
- `src/hooks/useNBAStandings.ts` — Hook that computes standings from `schedule_games` data already fetched in TeamsPage. Calculates W/L, PCT, GB, home/away splits, conference/division records, PPG, OPP PPG, DIFF, L10, streak. Uses `NBA_TEAMS` for logos/colors and the fallback file for conference/division assignments.
- `src/components/standings/StandingsPanel.tsx` — Panel with sub-tabs: League | Conference | Division
- `src/components/standings/StandingsTable.tsx` — Reusable sortable table with columns: #, Team, GP, W, L, PCT, GB, HOME, AWAY, CONF, DIV, PPG, OPP, DIFF, L10, STRK. Sticky header, alternating rows, hover. Playoff cutoff lines after position 6 (Play-In) and 10 (Eliminated). Clinch badges (z/y/x/e). Team logo + name clickable → opens TeamModal.
- `src/components/standings/StandingsFilters.tsx` — Sub-tab selector for League/Conference/Division views

**Conference view:** Side-by-side tables (East | West) on desktop, stacked on mobile.
**Division view:** 6 mini-tables grouped by division.

Data source: Entirely from `schedule_games` table (already queried). No external NBA Stats API needed — all W/L/home/away/conf/div records can be computed from game results + the static conference/division mapping.

### 2. Box Score — Add $ (Salary) and V (Value) Columns

**File:** `supabase/functions/game-boxscore/index.ts`

Add `salary` to the player select: `.select("id, name, fc_bc, photo, team, salary")` and include `salary: Number(p.salary)` in the response.

**File:** `src/lib/contracts.ts`

Add `salary: NumSchema` to `GameBoxscorePlayerSchema`. Remove `.strict()` or add the field.

**File:** `src/components/ScheduleList.tsx`

- Add two new columns after FP: `$` (salary) and `V` (value = fp/salary)
- Update `SORT_COLUMNS` to include `{ key: "salary", label: "$" }` and `{ key: "value", label: "V" }`
- Update grid template from `repeat(7,40px)` to `repeat(9,40px)`
- Style the `$` and `V` headers with a distinct color (e.g., `text-amber-400`)
- Compute value inline: `(p.fp / (p.salary || 1)).toFixed(1)`

### Files Summary

| File | Change |
|------|--------|
| `src/pages/TeamsPage.tsx` | Add Teams/Standings tab bar |
| `src/types/standings.ts` | New — StandingRow type |
| `src/data/nbaTeamsFallback.ts` | New — conference/division mapping for 30 teams |
| `src/hooks/useNBAStandings.ts` | New — compute standings from schedule_games |
| `src/components/standings/StandingsPanel.tsx` | New — top-level panel with sub-tabs |
| `src/components/standings/StandingsTable.tsx` | New — sortable standings table |
| `src/components/standings/StandingsFilters.tsx` | New — League/Conference/Division selector |
| `supabase/functions/game-boxscore/index.ts` | Add salary to response |
| `src/lib/contracts.ts` | Add salary to GameBoxscorePlayerSchema |
| `src/components/ScheduleList.tsx` | Add $ and V columns with distinct header color |

