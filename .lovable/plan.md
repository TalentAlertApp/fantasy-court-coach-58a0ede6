## Goal

Three connected changes:

1. **Real `transactions-simulate`** — compute league-scoped before/after preview instead of zeros.
2. **WNBA salary generation** — derive every WNBA salary from EXP, range $4.5M–$25M, persist to DB as the only source of truth.
3. **League is a property of the fantasy team** (not a global toggle). Set on Create Team, surfaced in Team Switcher, drives all data scoping. Remove the always-visible global LeagueSwitcher from the sidebar.

---

## 1. transactions-simulate (real preview)

Edit `supabase/functions/transactions-simulate/index.ts`:

- Read `{ outs:number[], ins:number[] }` from body, plus `team_id` via `resolveTeam`.
- Resolve team's `league_id` from `teams` row.
- Load current roster (joined with `players` filtered by team's `league_id`) → compute `before`:
  - `salary_used` = sum of salaries
  - `bank_remaining` = `100 - salary_used`
  - `proj_fp5` = sum of `fp_pg5`
  - `proj_stocks5` = sum of `stl5 + blk5` (fall back to 0 if null — pre-season)
- Load IN players from `players` filtered by same `league_id`. Reject any whose `league_id` ≠ team's league with `errors: ["cross_league:<id>"]`.
- Compute `after` = before − OUT contributions + IN contributions.
- `delta` = after − before for `proj_fp5`, `proj_stocks5`, `proj_ast5`.
- Validation warnings: salary cap >$100M, max-2-per-NBA/WNBA-team, FC/BC remains 5/5, roster size still 10.
- Set `is_valid` = no errors. Keep envelope shape unchanged.

Pre-season WNBA: when all `fp_pg5` are null/0, projections will read 0; that's fine (UI banner already explains).

---

## 2. WNBA salary generation (EXP → salary, persisted)

Rules:
- Allowed range: 3–30 (kept for future).
- Current generation window: min 4.5, max 25.
- Rookies (`exp = "R"` or 0) → 4.5.
- Highest EXP value across WNBA players → 25.
- Linear interpolation in between, rounded to 0.1.

Implementation:

a) **New edge function `wnba-salary-recalc`** (`supabase/functions/wnba-salary-recalc/index.ts`):
   - Admin-guarded (reuse `_shared/admin-guard.ts`).
   - Resolve WNBA `league_id`.
   - Select `players` where `league_id = wnba`, fields `id, exp`.
   - Parse `exp`: `"R"` → 0, numeric strings → int.
   - Compute `maxExp = max(exp)`.
   - For each player: `salary = round1(4.5 + (exp / maxExp) * (25 - 4.5))` (rookies get 4.5).
   - Bulk update `players.salary` via upserts in batches of 100.
   - Return `{ updated, min, max, distribution }`.

b) **Commissioner UI**: add a "Recalculate WNBA Salaries" button in the WNBA tab of `CommissionerPage.tsx`, calls the new function, shows summary toast.

c) **Make this the source of truth**: salary stays in `players.salary`; no other writes will overwrite it (existing `salary-update` is NBA-scoped — confirm and add a guard rejecting WNBA league_id rows).

---

## 3. League is a fantasy-team property (no global toggle)

### Schema (migration)
- `teams` already has `league_id`. Use it as the league source per team. No new column required (we'll resolve `league_code` via the existing `leagues` table).
- Backfill: any `teams.league_id` that points to the legacy placeholder `00000000-...0010` or is null → set to NBA league_id. (Migration UPDATE.)

### Backend

**`supabase/functions/teams/index.ts`**
- POST: accept `league_code` ("nba"|"wnba"), required. Resolve to `league_id` and insert.
- GET: join `leagues` so each returned team has `league_code` (e.g. select with a follow-up map, or include `league_id` and resolve client-side).
- PATCH: do not allow changing league after creation (return 400 if attempted).

### Frontend

**Remove the global league toggle**:
- Delete `<LeagueSwitcher />` usage from `AppLayout` sidebar (file: `src/components/layout/AppLayout.tsx`). Keep the component file but unused (or delete).
- `LeagueContext` becomes **derived from the selected team**, not user-controlled:
  - `LeagueProvider` reads `useTeam().selectedTeamId`, looks up that team's `league_code` (fetched via teams query), exposes `league`. `setLeague` becomes a no-op (or removed; callers updated).
  - Default: `"nba"` while loading or for legacy teams with no code.
  - `getCurrentLeague()` keeps working for `apiFetch` (still mirrors module-level state).

**Create Team flow**:
- `src/components/onboarding/NameStep.tsx`: add a League radio (NBA / WNBA) below team name.
- `src/components/TeamSwitcher.tsx` "New Team" dialog: add same League radio.
- `src/lib/api.ts createTeam`: pass `league_code`.
- "League profile/rules preset" — for now just store `league_code`; presets handled by the existing roster rules (already league-aware).

**Team Switcher badge**:
- In `src/components/TeamSwitcher.tsx` and `src/components/layout/HeaderTeamPill.tsx`: render a small `NBA` / `WNBA` chip next to the team name in the trigger and each `SelectItem`.

**Commissioner**:
- Keep the existing WNBA league mode toggle on `/commissioner` only (admin tooling — not user-facing app chrome). It already exists; no global toggle anywhere else.

### Acceptance verification
- Sidebar no longer shows the league dropdown.
- Create Team requires NBA/WNBA pick.
- Switching teams swaps the entire app's data automatically (queryClient invalidation already in `LeagueProvider`).
- Legacy teams default to NBA via backfill.

---

## Technical notes

- `LeagueContext` rewrite: keep API surface (`useLeague`, `getCurrentLeague`, `isWnba`) but compute `league` from `teams.find(t.id===selectedTeamId).league_code`. Invalidate queries when the resolved league changes (effect on `[league]`).
- `transactions-simulate` projections: `proj_ast5` needs a column on `players` — if not present, fall back to `ast` season avg.
- Salary recalc keeps salaries deterministic; running it twice yields the same numbers. Safe to re-run.
- Migration only adds NOT NULL/default behavior on `teams.league_id` if currently nullable — keep nullable but backfill, validate at API layer.

## Files

Edit:
- `supabase/functions/transactions-simulate/index.ts`
- `supabase/functions/teams/index.ts`
- `supabase/functions/salary-update/index.ts` (guard against WNBA writes)
- `src/contexts/LeagueContext.tsx`
- `src/components/layout/AppLayout.tsx` (remove LeagueSwitcher)
- `src/components/TeamSwitcher.tsx` (league badge + new-team league field)
- `src/components/layout/HeaderTeamPill.tsx` (league badge)
- `src/components/onboarding/NameStep.tsx` (league field)
- `src/pages/OnboardingPage.tsx` (pass league to createTeam)
- `src/lib/api.ts` (`createTeam` signature)
- `src/pages/CommissionerPage.tsx` (Recalc WNBA Salaries button)

Create:
- `supabase/functions/wnba-salary-recalc/index.ts`
- One migration: backfill `teams.league_id` for legacy rows.
