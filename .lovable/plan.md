## Prompt #1 (revised) — Historical scoring integrity + correct per-week Captain handling

Baseline acknowledged (NBA/WNBA sport leagues, Main fantasy league, leagues/teams/scoring_systems/scoring_rules/team_chips already exist; additive only; never touch unlisted files). Files in scope are exactly the four listed.

**Captain rule (carry-forward note for all later prompts):** the Gameday Captain is a chip used **once per gameweek**. In the data this is already encoded correctly — the `roster` table is keyed per `(team_id, gw, day, player_id)`, and `is_captain = true` exists on **at most one (gw, day) row per team per gameweek**. Captain bonus must therefore be applied **only on the specific game day where that player has `is_captain = true` for that team and gameweek** — not to every appearance of the player across the season.

The current `scoring-history` and `league-standings` both load the roster without the `gw, day` filter and treat any captain as captain-for-everything. That's the bug behind retroactive recalculation. This prompt fixes it.

---

### Step 1 — Migration: `scoring_daily_team_totals`

New file: `supabase/migrations/<timestamp>_scoring_daily_team_totals.sql`

```sql
create table public.scoring_daily_team_totals (
  id                 uuid primary key default gen_random_uuid(),
  fantasy_league_id  uuid not null references public.leagues(id),
  team_id            uuid not null references public.teams(id) on delete cascade,
  gw                 int  not null,
  day                int  not null,
  game_date          date not null,
  total_fp           numeric(10,2) not null default 0,
  captain_bonus      numeric(10,2) not null default 0,
  chip_bonus         numeric(10,2) not null default 0,
  player_breakdown   jsonb not null default '[]'::jsonb,
  scoring_system_id  uuid not null references public.scoring_systems(id),
  calculated_at      timestamptz not null default now(),
  unique (team_id, gw, day)
);

alter table public.scoring_daily_team_totals enable row level security;

create policy "scoring_daily_team_totals: public read"
  on public.scoring_daily_team_totals for select using (true);

create index idx_sdtt_team_gw_day on public.scoring_daily_team_totals (team_id, gw, day);
create index idx_sdtt_league_gw   on public.scoring_daily_team_totals (fantasy_league_id, gw);
```

`player_breakdown` shape per element: `{ player_id, name, fp, is_captain, captain_bonus, slot, pts, reb, ast, stl, blk, mp }`. `is_captain` reflects whether that player was the captain **on this specific (gw, day)** — never a season-wide flag.

No write policies — edge functions use the service role.

### Step 2 — Per-system rules cache in `_shared/scoring.ts`

Replace the single-slot cache with a Map keyed by `scoring_system_id`. TTL stays at 5 minutes.

```ts
const _rulesCache = new Map<string, { ts: number; rules: ScoringRule[] }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function fetchScoringRules(sb, systemId = "00000000-0000-0000-0000-000000000001") {
  const now = Date.now();
  const hit = _rulesCache.get(systemId);
  if (hit && now - hit.ts < CACHE_TTL_MS) return hit.rules;
  const { data, error } = await sb
    .from("scoring_rules")
    .select("stat_key, rule_type, weight, applies_to, is_active")
    .eq("scoring_system_id", systemId)
    .eq("is_active", true);
  if (error) throw error;
  const rules = (data ?? []) as ScoringRule[];
  _rulesCache.set(systemId, { ts: now, rules });
  return rules;
}
```
Drop the old `_cachedRules`. No exported signatures change.

### Step 3 — `scoring-history`: per-(gw, day) roster, correct captain, then snapshot

The current function pulls one roster row set and treats `is_captain` as global. Replace with per-day resolution:

1. Resolve once at the top:
   - `team.league_id` from `teams`
   - `scoring_system_id = await fetchLeagueScoringSystemId(sb, league_id)`
   - `captainMult = captainMultiplier(rules)` (already exported, default 2x)
2. Load the **full per-(gw, day) roster** for the team (not just the latest):
   - `select gw, day, player_id, slot, is_captain from roster where team_id = ?`
   - Build `rosterByDay = Map<"gw.day", { playerIds: Set<number>, starters: Set<number>, captainId: number|null }>`
   - Use this map to:
     - decide which players' logs to score on each `(gw, day)` (only players actually rostered that day),
     - determine the captain for that exact `(gw, day)` (at most one),
     - mark `is_starter` per day.
   - Player IDs to fetch logs for = union across all daily rosters.
3. Inside the per-game-day loop, for each player log on `(gw, day)`:
   - `baseFp = computeFpFromRules(log, rules)`
   - `isCap = (rosterByDay.get(key)?.captainId === player_id)`
   - `captainBonus = isCap ? baseFp * (captainMult - 1) : 0`
   - `fp = baseFp + captainBonus`
   - Track `gd.captain_bonus += captainBonus`.
4. Build `players[]` with `{ ..., is_captain: isCap, captain_bonus: captainBonus }` and continue producing the same response shape (per-player `fp` already includes the captain bonus on that one day, matching how `league-standings` already works).
5. After the loop, upsert one row per game day, wrapped in try/catch (never fails the response):

```ts
try {
  const rows = gameDays.map(gd => ({
    fantasy_league_id: leagueId,
    team_id,
    gw: gd.gw,
    day: gd.day,
    game_date: gd.game_date,
    total_fp: gd.total_fp,
    captain_bonus: gd.captain_bonus,
    chip_bonus: 0,
    player_breakdown: gd.players.map(p => ({
      player_id: p.player_id, name: p.name, fp: p.fp,
      is_captain: p.is_captain, captain_bonus: p.captain_bonus ?? 0,
      slot: p.is_starter ? "STARTER" : "BENCH",
      pts: p.pts, reb: p.reb, ast: p.ast, stl: p.stl, blk: p.blk, mp: p.mp,
    })),
    scoring_system_id,
  }));
  if (rows.length) {
    const { error } = await sb
      .from("scoring_daily_team_totals")
      .upsert(rows, { onConflict: "team_id,gw,day" });
    if (error) console.error("[scoring-history snapshot upsert]", error);
  }
} catch (e) { console.error("[scoring-history snapshot]", e); }
```

Behavioural change visible to the user: captain FP is now correctly 2× **only on the captain's chosen game day** (today the page either misses or over-applies it depending on the latest captain row). This is exactly the integrity fix the prompt is asking for.

### Step 4 — `league-standings`: per-day captain in live path + snapshot fast path

Apply the same per-(gw, day) roster fix to the live calculation:

- Replace `select team_id, player_id, is_captain from roster` with `select team_id, gw, day, player_id, is_captain from roster`.
- Build `rosterByTeamDay: Map<team_id, Map<"gw.day", { playerIds:Set, captainId:number|null }>>`.
- In the per-team loop, for each log iterate the player's logs and look up the captain via `rosterByTeamDay.get(team.id).get("${sched.gw}.${sched.day}")` — only score the log if that player was on the roster for that (gw, day).

Then add the snapshot fast path between the existing steps 4 and 5:

```ts
const { data: snaps } = await sb
  .from("scoring_daily_team_totals")
  .select("team_id, gw, day, total_fp, calculated_at")
  .in("team_id", teamIds)
  .eq("fantasy_league_id", leagueId);

const snapByTeam = new Map<string, Array<{gw:number; day:number; total_fp:number; calculated_at:string}>>();
for (const s of (snaps ?? [])) {
  const arr = snapByTeam.get(s.team_id) ?? [];
  arr.push({ gw: s.gw, day: s.day, total_fp: Number(s.total_fp), calculated_at: s.calculated_at });
  snapByTeam.set(s.team_id, arr);
}
```

In the per-team aggregation:
- If `snapByTeam.get(team.id)?.length` → derive `total_fp`, `current_week_fp` (sum where `gw === currentGw`), `latest_day_fp` (row matching global `latestKey`), `best_week_fp`/`worst_week_fp`/`avg_fp_per_gw` (aggregate per-gw sums), `updated_at` = max `calculated_at`.
- Else → keep the (now corrected) live path.

### Step 5 — Verification (post-deploy)

- Migration applies; `scoring_daily_team_totals` exists with RLS public-read.
- `/scoring` → League tab loads; ranks consistent with prior values for finished gameweeks (modulo captain correction).
- `/scoring` → Your Team tab timeline still renders; the captain's per-day FP is doubled **only** on the day the captain chip was used that gameweek, every other day they appear at base FP.
- After making a transfer or moving the captain to a different day in the current gameweek, run `scoring-history` again → snapshot rows for past gameweeks exist; the response for past gameweeks reflects what was rostered/captained on each historical (gw, day), independent of today's roster state.

---

### Files changed (only)
- `supabase/migrations/<timestamp>_scoring_daily_team_totals.sql` (new)
- `supabase/functions/_shared/scoring.ts`
- `supabase/functions/scoring-history/index.ts`
- `supabase/functions/league-standings/index.ts`

No React, no other edge functions, no schema changes outside the new table.

### Note on UPSERT semantics (for later prompts)
Spec calls for `ON CONFLICT DO UPDATE`. With per-(gw, day) roster lookup the snapshot is already built from the historical roster state stored in `roster` rows for that day — so re-running `scoring-history` after a captain change in a future gameweek does NOT mutate past snapshots' values (the inputs themselves are immutable for past days). Full "freeze past gameweeks" guard (e.g. `where gw >= currentGw`) can be a later prompt; carry the captain-once-per-week note forward to Prompts #2–#11.