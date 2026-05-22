# EuroLeague follow-up fixes (7 items)

## 1) Commissioner league selector — wrong EuroLeague logo
`src/pages/CommissionerPage.tsx` still imports `euroleague-logo.svg`. Swap to `@/assets/euroleague-logo.png` (the badge already copied earlier).

## 5) Replace remaining SVG references everywhere
Same import swap in:
- `src/lib/euroleague-teams.ts`
- `src/components/welcome-back/WelcomeBackHero.tsx`
- `src/components/FeedbackModal.tsx`
- `src/pages/CreateLeaguePage.tsx`
- `src/pages/AuthPage.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/components/onboarding/OnboardingHero.tsx`
- `src/lib/competitions.ts`: change `publicLogo: "/leagues/euroleague.svg"` to a PNG copy under `public/leagues/euroleague.png` (copy from `public/brand/...` or the uploaded badge). Delete the old `src/assets/euroleague-logo.svg` + `public/leagues/euroleague.svg`.

## 2) Skipped game-data rows (Llull / Motiejunas / Heurtel etc.)
Root cause: the **Game Data tab** uses different player IDs than **DB_Players** (e.g. 700966295 vs 700982991 for Llull). Currently we drop rows whose `player_id` is not in the `players` table.

Fix in `supabase/functions/euroleague-sheet-sync/index.ts` `syncGameData`:
1. Build a secondary lookup keyed by **normalized name + team tricode** from the `players` table.
2. When `teamById.get(playerId)` misses, try the name+team lookup; if it resolves, **rewrite `player_id` to the canonical DB player id** for the inserted log row.
3. If still unresolved, **auto-insert a stub player** into `players` for that league (id, name, team, position=null, salary=0, salary_source="placeholder", `created_via='gamedata-fallback'` note in a comment column if available — else just leave defaults). This keeps logs landing and surfaces the player in pool.
4. Return both `skipped_players` (truly unresolved) and a new `aliased_players` list (id→canonical) so commissioner can review.

Surface `aliased_players` count + expandable list in `EuroleagueSheetSyncPanel.tsx` next to the existing skipped block.

## 3) "Name Your Franchise" — EUROLEAGUE title still clipped, logo smaller
In `src/components/LeaguePickerCards.tsx`:
- Reduce big-size letter-spacing for the title so the longest word fits: `text-xl tracking-[0.18em]` (or `tracking-wide`) instead of `tracking-[0.3em]`. Add `text-center break-words leading-tight max-w-full px-1`.
- The EuroLeague badge PNG has internal padding which makes it appear smaller than NBA/WNBA SVGs. Add a per-league logo size override in `FANTASY_COMPETITIONS` (`logoScale?: number`) and apply `style={{ transform: `scale(${logoScale ?? 1})` }}` on the visible logo `<img>` — set `1.25` for EuroLeague so it visually matches NBA/WNBA.

## 4) EuroLeague salaries all $0 — add commissioner recalc job
No `exp` field for EuroLeague. Build deterministic salary from **last-season fantasy production** with a fallback:

Formula (per player, league-scoped):
- Inputs from `players_advanced_stats_season` (or whichever advanced-accum table holds totals) and `players.games_played`:
  - `score = 0.6 * fp_per_game + 0.25 * min_per_game + 0.15 * fp_total_normalized`
  - If no advanced row → fallback `score = age_curve(age)` where peak (24–29) = mid, rookies = SAL_MIN, vets >34 = mid–.
- Linear-map league `score` range → `[SAL_MIN=4.5, SAL_MAX=25]`, round to 0.1.
- Players with no signal at all → `SAL_MIN`, `salary_source='placeholder'`. Players with computed salary → `salary_source='computed'`.

New edge function `supabase/functions/euroleague-salary-recalc/index.ts` (mirrors `wnba-salary-recalc`):
- Scoped to EuroLeague league_id, never touches NBA/WNBA.
- Returns `{ updated, failed, min, max, distribution, source_breakdown }`.

Add a button row in `EuroleagueSheetSyncPanel.tsx` (or a sibling `EuroleagueSalaryPanel.tsx`) on `/commissioner` labeled **"Recalculate EuroLeague Salaries"**.

## 6) EuroLeague injury report — empty state
In `src/components/InjuryReportModal.tsx` extend league branching: when `league === "euroleague"`, do **not** call any injury edge function. Render an empty/placeholder state ("Injury feed coming soon for EuroLeague") and skip the NBA fetch entirely. Also hide/disable the refresh button for EuroLeague.

## 7) /schedule game cards missing EuroLeague venue art + name
`ScheduleList.tsx` (and `SchedulePreviewPanel.tsx`) call `getVenue(home_team)` from `@/lib/nba-venues`, which only knows NBA teams. EuroLeague venue data already lives in the `teams` table (`venue_name`, `venue_image_url`) and is exposed through `useLeagueTeams` (`venueName`, `venueImage`).

Plan:
- Add a small league-aware helper `useVenueLookup()` that returns `(teamCode) => { name, image }`:
  - NBA → existing `getVenue`.
  - WNBA → existing WNBA path (if any) else teams-table.
  - EuroLeague → map from `useLeagueTeams()` rows by `team_code` → `{ name: venueName, image: venueImage }`.
- Replace the `getVenue(g.home_team)` call sites in `ScheduleList.tsx` (3 spots) and `SchedulePreviewPanel.tsx` with the hook output. No NBA logic changes.
- For the missing teams data, import-game-data already maps tricodes — venue strings come straight from `teams` rows synced via DB_Teams. User confirmed the spreadsheet has the URLs; if any are still missing, the panel's "Sync Teams" already covers it (no schema changes needed since `venue_name` + `venue_image_url` columns exist).

## Files touched
- `src/lib/competitions.ts`
- `src/components/LeaguePickerCards.tsx`
- `src/components/InjuryReportModal.tsx`
- `src/components/ScheduleList.tsx`, `src/components/SchedulePreviewPanel.tsx`
- `src/components/commissioner/EuroleagueSheetSyncPanel.tsx` (+ maybe new `EuroleagueSalaryPanel.tsx`)
- 7 logo-import swaps listed above; delete `src/assets/euroleague-logo.svg`, `public/leagues/euroleague.svg`; add `public/leagues/euroleague.png`
- `supabase/functions/euroleague-sheet-sync/index.ts` (alias + stub insert)
- `supabase/functions/euroleague-salary-recalc/index.ts` (new)
- New `src/hooks/useVenueLookup.ts`

No DB migrations required.

## Out of scope (deferred)
- Manually curating an alias table for the long tail of EuroLeague player ID drift across seasons.
- Real injury feed for EuroLeague.
