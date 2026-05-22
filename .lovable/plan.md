# EuroLeague — Additive Third Competition

Adds EuroLeague (`euroleague`, 2025‑26) alongside NBA and WNBA. The hard rule is **no behavioral or data change** for NBA/WNBA. EuroLeague ships as an additive option, with a single‑table standings model and Advanced/PLAY SEARCH disabled.

The logo already supplied is saved to `public/leagues/euroleague.svg`.

---

## 1. Competition registry (new single source of truth)

Create `src/lib/competitions.ts`:

```ts
export type CompetitionCode = "nba" | "wnba" | "euroleague";

export interface Competition {
  code: CompetitionCode;
  label: string;          // "EuroLeague"
  shortLabel: string;     // "EL"
  season: string;         // "2025-26"
  logo: string;           // public path
  standingsMode: "conference_division" | "conference_only" | "single_table";
  hasAdvancedPlaySearch: boolean;
  hasConferences: boolean;
  hasDivisions: boolean;
  fantasyEnabled: boolean;
}

export const COMPETITIONS: Record<CompetitionCode, Competition> = {
  nba:        { code: "nba",        label: "NBA",        shortLabel: "NBA", season: "2025-26",
                logo: "/leagues/nba.svg",        standingsMode: "conference_division",
                hasAdvancedPlaySearch: true,  hasConferences: true,  hasDivisions: true,  fantasyEnabled: true },
  wnba:       { code: "wnba",       label: "WNBA",       shortLabel: "WNBA", season: "2025-26",
                logo: "/leagues/wnba.svg",       standingsMode: "conference_only",
                hasAdvancedPlaySearch: true,  hasConferences: true,  hasDivisions: false, fantasyEnabled: true },
  euroleague: { code: "euroleague", label: "EuroLeague", shortLabel: "EL",   season: "2025-26",
                logo: "/leagues/euroleague.svg", standingsMode: "single_table",
                hasAdvancedPlaySearch: false, hasConferences: false, hasDivisions: false, fantasyEnabled: true },
};

export function getCompetition(code: string): Competition {
  const c = COMPETITIONS[code as CompetitionCode];
  if (!c) throw new Error(`Unknown competition code: ${code}`);
  return c;
}
export function isKnownCompetition(code: string): code is CompetitionCode {
  return code === "nba" || code === "wnba" || code === "euroleague";
}
export const ALL_COMPETITIONS = Object.values(COMPETITIONS);
```

A mirror `supabase/functions/_shared/competitions.ts` will hold the same registry for edge functions, so the server also rejects unknown codes (replacing the silent `"wnba" : "nba"` ternary in `_shared/league.ts`).

## 2. Type widening — `CompetitionCode` everywhere a literal lives

Replace `"nba" | "wnba"` with `CompetitionCode` in:

- `src/contexts/LeagueContext.tsx` (`LeagueCode`, `getCurrentLeague`)
- `src/contexts/FantasyLeagueContext.tsx` (`sportCode`, `getCurrentFantasySport`)
- `src/hooks/useFantasyLeagues.ts` (`FantasyLeague.sport`)
- `src/hooks/useLeagueTeams.ts` return tuple
- `supabase/functions/_shared/league.ts`

The header pill / team `league_code` field already exists; widen the comparison to use `isKnownCompetition` rather than NBA‑fallback.

## 3. Hard error on unknown league_code

- `LeagueContext`: if `selectedTeam.league_code` is set but not recognized, **throw a typed error** caught by an `<LeagueErrorBoundary>` that renders "Unsupported league". No silent fallback to NBA.
- `_shared/league.ts` `readLeagueCode*` functions return the raw string; `resolveLeagueId` already throws if the leagues row is missing. Add explicit `if (!isKnownCompetition(raw)) throw …` so unknown values fail fast at the function boundary.

## 4. Teams catalog — add EuroLeague

- New `src/lib/euroleague-teams.ts` exporting `EUROLEAGUE_TEAMS: LeagueTeam[]` (18 clubs of 2025‑26: RMB, FCB, OLY, PAN, EFS, FEN, MTA, ASM, ZAL, BAS, VIR, MIL, PAR, BAY, ASV, PRS, DUB, HAP). Conference/division `null`. Logos sourced from `https://media-cdn.incrowdsports.com/...` (EuroLeague CDN); placeholder asset paths for any missing.
- `useLeagueTeams` adds a third branch:
  ```ts
  if (league === "euroleague") return { league, teams: EUROLEAGUE_TEAMS };
  ```

## 5. Standings — `single_table`

`useNBAStandings`, `useLeagueStandings`, `StandingsPanel`, `StandingsFilters`:
- Read `getCompetition(code).standingsMode` to decide whether to render the View toggle.
- For `single_table`, force `view = "league"` and hide the toggle.
- Edge function `league-standings` returns a flat table with no `conference`/`division` grouping when the registry says so.

NBA/WNBA paths are unchanged because both still resolve to existing modes.

## 6. Advanced / PLAY SEARCH gate

`src/pages/AdvancedPage.tsx`:
- At entry, `const comp = getCompetition(league);`
- If `!comp.hasAdvancedPlaySearch`, render a small "Not available for {label} yet" empty state, no fetches.
- Sidebar/nav link to `/advanced` hides for EuroLeague (`AppLayout` reads the same flag).

NBA/WNBA URL building (already fixed earlier) is untouched.

## 7. League selectors / pickers

`LeaguePickerCards`, `ChooseLeagueStep`, `TeamSwitcher`, `HeaderTeamPill`, `TeamLeagueChips`, `LeagueLogoBadge`:
- Iterate over `ALL_COMPETITIONS` (filtered by `fantasyEnabled`) instead of the two‑item hardcoded arrays.
- Logos, labels, short labels all come from the registry.
- EuroLeague appears as a selectable option, but does **not** become anyone's default — onboarding/`MAIN_LEAGUE_ID` constants are left alone.

## 8. Database — add EuroLeague rows (additive)

A single migration adds rows; no destructive changes:

```sql
-- public.leagues: add EuroLeague competition row
insert into public.leagues (id, code, name)
values ('00000000-0000-0000-0000-000000000003', 'euroleague', 'EuroLeague')
on conflict (code) do nothing;

-- Main fantasy league entry for EuroLeague (mirrors MAIN_LEAGUE_NBA_ID / WNBA_ID pattern)
insert into public.fantasy_leagues (id, sport, name, kind, visibility, status)
values ('00000000-0000-0000-0000-000000000030', 'euroleague', 'EuroLeague Main', 'main', 'public', 'active')
on conflict (id) do nothing;
```

(Exact `fantasy_leagues` column list will be reconciled to the live schema before the migration is run. Any `sport CHECK (sport in ('nba','wnba'))` constraint is dropped and re‑added including `'euroleague'` — non‑destructive to existing rows.)

`MAIN_LEAGUE_EUROLEAGUE_ID` constant added to `useFantasyLeagues.ts` alongside the existing two.

## 9. Edge function audit (no functional changes, just allow the new code)

For each function that reads `league_code`:
- `_shared/league.ts` — registry import, hard error on unknown.
- `teams`, `players-list`, `player-detail`, `roster-current`, `roster-save`, `roster-auto-pick`, `schedule`, `schedule-impact`, `league-standings`, `scoring-history`, `transactions-*`, `salary-*`, `import-*`, `leagues-*`, `last-game`, `game-boxscore`, `ai-coach`, `court-show-intelligence`, `youtube-recap-lookup`, `nba-injury-report`, `wnba-injury-report`, `deadline-status` — accept `"euroleague"`. None of these have NBA‑specific business logic that would break when no rows exist.

NBA/WNBA‑specific functions (`wnba-sheet-sync`, `wnba-salary-recalc`, `wnba-salary-season-backfill`, `nba-injury-report`, `wnba-injury-report`) stay sport‑scoped and untouched.

## 10. Test & verify

- `src/test/example.test.ts` style: new `competitions.test.ts` asserting registry shape, `getCompetition` throws on unknown, `isKnownCompetition` matrix.
- Manual smoke (post‑build):
  - NBA route loads players / roster / schedule / standings exactly as today.
  - WNBA route loads identically.
  - EuroLeague appears in `LeaguePickerCards`, header pill, `TeamSwitcher`. Selecting it routes through the same pages; standings show a single table; Advanced shows the "not available" notice; no crash.
  - Sending `league_code=foo` to any edge function returns a clear 400 instead of NBA data.

---

## Technical notes

- This is purely additive. No existing constants (`MAIN_LEAGUE_NBA_ID`, `MAIN_LEAGUE_WNBA_ID`), tables, RLS, or edge function names change.
- `localStorage` key `fcc_fantasy_league_id` is preserved; a stored EuroLeague id is honoured but the fallback chain (`stored → MAIN_LEAGUE_ID → first accessible`) keeps NBA users on NBA.
- Player data for EuroLeague is **not** populated by this change; the registry and UI plumbing land first so subsequent imports have somewhere to land.
- Estimated touch: ~30 frontend files (mostly 1–3 line swaps from literal unions to `CompetitionCode` + registry lookups), 1 new SVG asset, 1 new teams file, 1 new competitions module, 1 mirrored edge‑function shared module, 1 migration.
