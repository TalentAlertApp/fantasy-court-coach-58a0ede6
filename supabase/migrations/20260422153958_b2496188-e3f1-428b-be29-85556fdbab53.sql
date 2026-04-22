-- ============================================================
-- Leagues + Scoring Engine (table-driven)
-- ============================================================

-- 1. Scoring engine
create table public.scoring_systems (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  sport text not null default 'nba',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  scoring_system_id uuid not null references public.scoring_systems(id) on delete cascade,
  stat_key text not null,
  rule_type text not null default 'multiplier',
  weight numeric not null default 0,
  applies_to text not null default 'player',
  sort_order int not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scoring_system_id, stat_key, applies_to)
);

-- 2. Leagues
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  scoring_system_id uuid not null references public.scoring_systems(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Teams gain league_id
alter table public.teams add column league_id uuid references public.leagues(id);

-- 4. Seed default scoring system + rules + league (fixed UUIDs)
insert into public.scoring_systems (id, code, name)
values ('00000000-0000-0000-0000-000000000001', 'nba_classic', 'NBA Classic');

insert into public.scoring_rules (scoring_system_id, stat_key, weight, sort_order) values
  ('00000000-0000-0000-0000-000000000001', 'pts', 1, 1),
  ('00000000-0000-0000-0000-000000000001', 'reb', 1, 2),
  ('00000000-0000-0000-0000-000000000001', 'ast', 2, 3),
  ('00000000-0000-0000-0000-000000000001', 'stl', 3, 4),
  ('00000000-0000-0000-0000-000000000001', 'blk', 3, 5);

-- Captain placeholder rule (multiplier on top of player FP)
insert into public.scoring_rules (scoring_system_id, stat_key, rule_type, weight, applies_to, sort_order)
values ('00000000-0000-0000-0000-000000000001', 'fp_total', 'multiplier', 2, 'captain', 99);

insert into public.leagues (id, code, name, scoring_system_id) values
  ('00000000-0000-0000-0000-000000000010', 'main', 'Main League', '00000000-0000-0000-0000-000000000001');

-- 5. Backfill existing teams
update public.teams set league_id = '00000000-0000-0000-0000-000000000010' where league_id is null;
alter table public.teams alter column league_id set not null;

-- 6. RLS — public read on standings-relevant tables
alter table public.leagues enable row level security;
alter table public.scoring_systems enable row level security;
alter table public.scoring_rules enable row level security;

create policy "leagues: public read" on public.leagues for select using (true);
create policy "scoring_systems: public read" on public.scoring_systems for select using (true);
create policy "scoring_rules: public read" on public.scoring_rules for select using (true);

-- 7. Public-safe team summary view (security_invoker so it respects auth.users access via SECURITY DEFINER fn)
-- We use a SECURITY DEFINER function approach instead, since auth.users is restricted.
create or replace function public.get_league_teams(_league_id uuid)
returns table (
  id uuid,
  name text,
  league_id uuid,
  created_at timestamptz,
  owner_id uuid,
  owner_label text
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, t.league_id, t.created_at, t.owner_id,
         split_part(coalesce(u.email, 'user'), '@', 1) as owner_label
  from public.teams t
  left join auth.users u on u.id = t.owner_id
  where t.league_id = _league_id
$$;

grant execute on function public.get_league_teams(uuid) to anon, authenticated;