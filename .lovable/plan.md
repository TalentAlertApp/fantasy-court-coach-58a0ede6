

## Two-part scope: (0) tooltip clipping fix, then (1) full league + scoring-rules refactor

This is a substantial backend + UI change. I'll split into two implementation rounds so each lands clean.

---

## Round 1 — Tooltip clipping fix (small, ship first)

**Root cause**: `src/components/ui/tooltip.tsx` renders `TooltipPrimitive.Content` inline, so when a tooltip is inside a parent with `overflow-hidden` (the matchup card), it gets clipped. Radix solves this via `TooltipPrimitive.Portal`, which renders into `document.body`.

**Fix**: Wrap `TooltipContent` in `<TooltipPrimitive.Portal>`. Bump default `z-index` on the content to `z-[100]` so it sits above all overlays/modals. No other call-sites need to change — every tooltip in the app benefits automatically.

---

## Round 2 — Single shared league + table-driven scoring + /scoring redesign

### A. Schema migration (`supabase/migrations/<timestamp>_leagues_scoring.sql`)

```sql
-- 1. Scoring engine (sport-agnostic, multi-rule, future-proof)
create table public.scoring_systems (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,           -- 'nba_classic'
  name text not null,
  sport text not null default 'nba',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  scoring_system_id uuid not null references public.scoring_systems(id) on delete cascade,
  stat_key text not null,              -- 'pts','reb','ast','stl','blk','to'
  rule_type text not null default 'multiplier',  -- 'multiplier'|'flat_bonus'|'flat_penalty'
  weight numeric not null default 0,
  applies_to text not null default 'player',     -- 'player'|'team'|'captain'
  sort_order int not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scoring_system_id, stat_key, applies_to)
);

-- 2. Leagues (one row seeded; structure ready for many)
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,           -- 'main'
  name text not null,                  -- 'Main League'
  scoring_system_id uuid not null references public.scoring_systems(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Teams gain league_id
alter table public.teams
  add column league_id uuid references public.leagues(id);

-- 4. Seed default scoring system + rules + league
insert into public.scoring_systems (id, code, name)
  values ('00000000-0000-0000-0000-000000000001','nba_classic','NBA Classic');

insert into public.scoring_rules (scoring_system_id, stat_key, weight, sort_order) values
  ('00000000-0000-0000-0000-000000000001','pts',1,1),
  ('00000000-0000-0000-0000-000000000001','reb',1,2),
  ('00000000-0000-0000-0000-000000000001','ast',2,3),
  ('00000000-0000-0000-0000-000000000001','stl',3,4),
  ('00000000-0000-0000-0000-000000000001','blk',3,5);

insert into public.leagues (id, code, name, scoring_system_id)
  values ('00000000-0000-0000-0000-000000000010','main','Main League',
          '00000000-0000-0000-0000-000000000001');

-- 5. Backfill: every existing team → main league
update public.teams set league_id = '00000000-0000-0000-0000-000000000010' where league_id is null;
alter table public.teams alter column league_id set not null;

-- 6. RLS — public read on standings-relevant tables
alter table public.leagues enable row level security;
alter table public.scoring_systems enable row level security;
alter table public.scoring_rules enable row level security;
create policy "leagues: public read" on public.leagues for select using (true);
create policy "scoring_systems: public read" on public.scoring_systems for select using (true);
create policy "scoring_rules: public read" on public.scoring_rules for select using (true);

-- 7. Public-safe team summary view (owner display label without email domain)
create or replace view public.league_teams_public as
select t.id, t.name, t.league_id, t.created_at,
       u.email as owner_email,
       split_part(u.email, '@', 1) as owner_label,
       t.owner_id
from public.teams t
join auth.users u on u.id = t.owner_id;

grant select on public.league_teams_public to anon, authenticated;
```

### B. Backend — league standings + table-driven scoring

**New edge function** `supabase/functions/league-standings/index.ts`
- Accepts `?league_id=…` (defaults to seeded `main` league).
- Loads `scoring_rules` for the league's `scoring_system_id`.
- For each team in the league:
  - Pulls roster + player_game_logs joined to `schedule_games` (gw, day).
  - Computes per-game FP using the **rule set** (`Σ stat_value * weight` for each `multiplier` rule). Captain bonus applied via the `applies_to='captain'` rule (currently empty; future-ready).
  - Aggregates: `total_fp`, `current_week_fp`, `latest_day_fp`, `avg_fp_per_gw`, `best_week_fp`, `worst_week_fp`, `updated_at`.
- Joins `league_teams_public` for `team_name`, `owner_label`.
- Returns sorted rows + small summary block (`league_leader`, `best_this_week`, `highest_single_week`, `total_teams`).
- Tie-breakers: `total_fp DESC, current_week_fp DESC, latest_day_fp DESC, created_at ASC`.

**Refactor** `supabase/functions/scoring-history/index.ts`
- Drop the implicit assumption that `fp` in `player_game_logs` is the truth; instead recompute per-game FP from `pts/reb/ast/stl/blk` using rules fetched from `scoring_systems` + `scoring_rules` for the team's league. Keeps backward compatibility (existing `fp` column stays, new code path wins).
- Helper `computeFpFromRules(stats, rules)` lives in `supabase/functions/_shared/scoring.ts` (NEW) and is shared by both `scoring-history` and `league-standings` (and `sync-sheet` going forward).

**Refactor** `supabase/functions/sync-sheet/index.ts`
- Replace inline `computeFP` with the shared helper, fetching rules from the DB on cold start (cached per invocation).

**Refactor** `supabase/functions/health/index.ts`
- Return `scoring_rules` dynamically from the active scoring system (drop the hardcoded `z.literal` schema; loosen to `z.record(z.string(), z.number())`).

### C. Frontend hooks + types

- `src/hooks/useLeagueStandings.ts` (NEW) — pulls `league-standings` for the active league; `staleTime: 60s`.
- `src/hooks/useScoringSystem.ts` (NEW) — fetches active rules from supabase client (`from('scoring_rules')`); used by HowToPlay modal.
- `src/hooks/useScoringHistory.ts` — unchanged signature; payload remains compatible.
- `src/lib/api.ts` — add `fetchLeagueStandings(leagueId?)`.

### D. /scoring page redesign (`src/pages/ScoringPage.tsx`)

Wrap existing content in shadcn `<Tabs>`:

**Tab 1 — "League"** (default)
- 4 KPI cards on top: League Leader · Best This Week · Highest Single Week · Total Teams.
- Standings table below: `# · Team · Owner · Total FP · This Wk · Last Day · Avg/GW · Best Wk · Worst Wk · Updated`.
- Row of the current user's selected team is highlighted with the NBA-yellow tint.
- Click a team row → switch to "Your Team" tab (only if owned by current user; otherwise open a read-only `TeamModal`-style sheet showing their roster summary).

**Tab 2 — "Your Team"**
- Above existing content: small `<Select>` listing only **the user's own teams** in this league. Setting it calls `setSelectedTeamId()` from `TeamContext` so the rest of the app (Roster/Transactions) stays in sync.
- Empty state when user has no teams: CTA → "Create your first team" routing to `/onboarding`.
- All current widgets (FP Timeline, day details, Starting 5 strip, Weekly Breakdown table) render **unchanged** below.
- Persist last-selected tab in `localStorage["nba_scoring_tab"]`.

### E. Other call-site cleanups

- `src/components/HowToPlayModal.tsx` — render the formula from `useScoringSystem()` instead of the hardcoded string. Falls back to the classic formula until rules load.
- `supabase/functions/ai-coach/index.ts` — inject the formula into the system prompt from the DB rules at request time (single line replacement). `PROJECT_CONTEXT.md` documents the new source of truth.
- `supabase/functions/teams/index.ts` POST — set `league_id` to the seeded main league when creating a team.

### F. Security recap
- `teams` RLS already enforces `owner_id = auth.uid()` for write paths — unchanged.
- `league_teams_public` view exposes only safe fields (`team name`, `owner_label`, `created_at`).
- `scoring_systems` / `scoring_rules` / `leagues` are public-read, no write policies (DB-managed only).
- `roster`, `transactions`, `team_settings` policies remain owner-scoped — no league_id leakage.

### Files touched / created

**New**
- `supabase/migrations/…_leagues_scoring.sql`
- `supabase/functions/league-standings/index.ts`
- `supabase/functions/_shared/scoring.ts`
- `src/hooks/useLeagueStandings.ts`
- `src/hooks/useScoringSystem.ts`

**Edited**
- `src/components/ui/tooltip.tsx` (Round 1 — Portal + z-index)
- `src/pages/ScoringPage.tsx` (tabs + standings UI)
- `src/components/HowToPlayModal.tsx` (rules from DB)
- `src/lib/api.ts` (new fetcher)
- `supabase/functions/teams/index.ts` (assign `league_id` on create)
- `supabase/functions/scoring-history/index.ts` (use shared scoring helper)
- `supabase/functions/sync-sheet/index.ts` (use shared scoring helper)
- `supabase/functions/health/index.ts` (dynamic rules)
- `supabase/functions/ai-coach/index.ts` (dynamic formula in prompt)

### Outcome
- **Tooltip**: never clipped, sits above any overlay/modal.
- **League**: one shared league seeded, every team auto-attached, schema ready for many.
- **Scoring page**: League tab (full standings + KPIs) + Your Team tab (existing widgets, with team selector).
- **Scoring engine**: driven by `scoring_systems` + `scoring_rules`; HowToPlay, AI Coach, sync, and history all read from the DB.
- **Backwards compatible**: existing rosters, transactions, scoring history continue to work — no data loss.

### Follow-ups (not in this round)
- Caching standings into a materialized table for very large leagues.
- Per-league transactions audit (already isolated by `team_id`, but a `league_id` denormalization would speed cross-league reports).
- Multi-league signup flow + league join codes.

