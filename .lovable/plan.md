## Scope

Two small UI/data fixes plus an acknowledgment of the 11-prompt baseline you shared.

Note on the 11-prompt baseline: that block is context for future prompts, not a request to implement now. I will treat it as the standing "BASELINE — DO NOT REBUILD" header for prompts #1–#11 when you start sending them. No code in this plan touches those areas.

---

## 1) TOTW: league logo in the top-right of the court

File: `src/components/TeamOfTheWeekModal.tsx`

- Read the active league via `useLeague()` (returns `"nba" | "wnba"`).
- Render a `<LeagueLogoBadge league={league} size="md" />` absolutely positioned inside the court container (the `div` at line 144 with `backgroundImage: courtBg`):
  - `absolute top-3 right-3 z-20`
  - Slight backdrop for legibility on the bright wood: `bg-black/40 rounded-full p-1.5 backdrop-blur-sm`
  - Bump logo size up (`h-8 w-8` via a wrapper) so it reads clearly at the modal scale.
- No layout changes elsewhere; the title strip and player formation stay as they are.

## 2) /schedule scheduled games: WNBA must show the WNBA conference standings (not NBA)

Problem: in `src/components/ScheduleList.tsx`, the expanded "EAST/WEST CONFERENCE" mini-table for upcoming games is built from `NBA_TEAM_META` regardless of league. For a WNBA game the screenshot shows NBA teams (MIL/NYK/ORL/PHI) instead of the WNBA East (ATL/CHI/CON/IND/NYL/TOR/WAS).

Fix, scoped to `src/components/ScheduleList.tsx` only:

- Build a small, league-aware meta lookup at module scope:
  - `getTeamMeta(tricode, league)` → `{ conference: "East" | "West" } | undefined`
  - For `"nba"`: read `NBA_TEAM_META`.
  - For `"wnba"`: derive from `WNBA_TEAMS` (`@/lib/wnba-teams`), normalising `"Eastern" | "Western"` → `"East" | "West"`.
- Make `computeConfStandings(data, tricode, league)` league-aware:
  - Source the team universe from the league's catalog (NBA_TEAM_META keys vs WNBA_TEAMS tricodes).
  - Filter by conference using the league-aware meta.
- Make `ConferenceTable` accept `league` (or a resolved `conferenceLabel`) and read the meta from the league-aware lookup so the heading ("East Conference" / "West Conference") and the displayed teams match.
- At every call site inside `ScheduleList.tsx`, pass `useLeague().league` through.
- Also update the standings accumulator near line 347 that seeds rows from `NBA_TEAM_META` so a WNBA view doesn't get padded with NBA tricodes:
  - Use `Object.keys(leagueMeta)` instead of `Object.keys(NBA_TEAM_META)` when building `allTricodes`.

No changes to `useStandingsContext` or other shared hooks — this fix stays inside `ScheduleList.tsx` because that's the only place rendering the offending block.

## 3) 11-prompt fantasy-leagues plan — acknowledgement only

No changes now. When you send Prompt #1 I'll prepend the BASELINE block you supplied and follow the additive-only / never-touch-unlisted-files rules.

---

## Technical notes

- Files touched: `src/components/TeamOfTheWeekModal.tsx`, `src/components/ScheduleList.tsx`.
- No DB migrations, no edge function changes, no new dependencies.
- WNBA conference values in `src/lib/wnba-teams.ts` are `"Eastern" | "Western"`; will normalise to `"East" | "West"` at the lookup boundary so the label and grouping stay consistent with the existing NBA path.
- Verification after implementation: open TOTW (NBA team and WNBA team) → logo visible top-right; on `/schedule` with a WNBA team selected, expanding a scheduled game shows ATL/CHI/CON/IND/NYL/TOR/WAS in the East table.