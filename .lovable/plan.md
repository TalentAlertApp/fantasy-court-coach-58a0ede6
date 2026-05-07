## Two bugs to fix

### Bug 1 — Injury Report icon doesn't open the modal in Grid view
`src/components/ScheduleList.tsx` returns early for `viewMode === "grid"` (around line 1068–1108) and renders its own set of modals (PlayerModal, TeamModal, GameDetailDialog, TeamCompareModal) — but **`InjuryReportModal` is only mounted in the list-view return** (line 1332). So clicking the Bandage icon on a grid card flips state but nothing renders.

**Fix:** Add the same `<InjuryReportModal …initialTeams=… />` block inside the grid-branch return (alongside the other modals at lines 1085–1105).

### Bug 2 — Compare modal shows H2H games from wrong league
`src/components/TeamCompareModal.tsx` queries `schedule_games` filtered only by team tricodes:
```ts
.or(`and(home_team.eq.${teamA},away_team.eq.${teamB}),and(home_team.eq.${teamB},away_team.eq.${teamA})`)
```
The DB confirms tricode collisions across leagues — e.g. comparing NBA `DAL` vs `ATL` returns 3 WNBA Dallas Wings vs Atlanta Dream games (May/Jul 2026) plus the 2 real NBA finals. Those are the bogus "scheduled" rows the user is seeing.

**Fix:** Constrain the H2H query to the current league.
- Import `useLeagueId` from `@/hooks/useLeagueId`.
- Get `const { data: leagueId } = useLeagueId();`
- Add `.eq("league_id", leagueId)` to the query and gate `enabled` on `!!leagueId`.
- Include `leagueId` in the queryKey so it refetches on league switch.

No other files affected. Both fixes are small and isolated.