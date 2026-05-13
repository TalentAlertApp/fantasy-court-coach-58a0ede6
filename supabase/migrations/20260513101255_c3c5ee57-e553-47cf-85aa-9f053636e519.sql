-- ============================================================
-- STEP 1 — extend leagues
-- ============================================================
alter table public.leagues
  add column if not exists owner_id              uuid references auth.users(id),
  add column if not exists description           text,
  add column if not exists visibility            text not null default 'private',
  add column if not exists join_code             text unique,
  add column if not exists status                text not null default 'active',
  add column if not exists max_teams             int  not null default 20,
  add column if not exists transfer_cap          int  not null default 2,
  add column if not exists roster_rule_set_id    uuid,
  add column if not exists deadline_rule_set_id  uuid,
  add column if not exists chip_rule_set_id      uuid;

do $$ begin
  alter table public.leagues add constraint leagues_visibility_chk
    check (visibility in ('private','invite_only','public'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.leagues add constraint leagues_status_chk
    check (status in ('draft','active','archived'));
exception when duplicate_object then null; end $$;

-- ============================================================
-- STEP 2 — extend scoring_systems
-- ============================================================
alter table public.scoring_systems
  add column if not exists owner_id    uuid references auth.users(id),
  add column if not exists is_template boolean not null default false;

update public.scoring_systems
  set is_template = true
  where id = '00000000-0000-0000-0000-000000000001';

-- ============================================================
-- STEP 3 — roster_rule_sets
-- ============================================================
create table if not exists public.roster_rule_sets (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  owner_id             uuid references auth.users(id),
  total_players        int  not null default 10,
  starters_count       int  not null default 5,
  bench_count          int  not null default 5,
  fc_slots             int  not null default 5,
  bc_slots             int  not null default 5,
  budget_cap           numeric(10,2),
  max_players_per_team int,
  is_template          boolean not null default false,
  created_at           timestamptz not null default now()
);

alter table public.roster_rule_sets enable row level security;

drop policy if exists "rrs: select template or own" on public.roster_rule_sets;
create policy "rrs: select template or own" on public.roster_rule_sets
  for select using (is_template or owner_id = auth.uid());

drop policy if exists "rrs: insert own" on public.roster_rule_sets;
create policy "rrs: insert own" on public.roster_rule_sets
  for insert with check (owner_id = auth.uid());

drop policy if exists "rrs: update own" on public.roster_rule_sets;
create policy "rrs: update own" on public.roster_rule_sets
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

insert into public.roster_rule_sets
  (id, name, total_players, starters_count, bench_count, fc_slots, bc_slots, is_template)
values
  ('00000000-0000-0000-0001-000000000001', 'Standard', 10, 5, 5, 5, 5, true)
on conflict (id) do nothing;

-- ============================================================
-- STEP 4 — deadline_rule_sets
-- ============================================================
create table if not exists public.deadline_rule_sets (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  owner_id            uuid references auth.users(id),
  deadline_type       text not null default 'first_game_of_day'
                      check (deadline_type in ('first_game_of_day','per_player_game_lock','fixed_weekly','manual')),
  timezone            text not null default 'UTC',
  minutes_before_game int  not null default 0,
  fixed_weekday       int,
  fixed_time          time,
  is_template         boolean not null default false,
  created_at          timestamptz not null default now()
);

alter table public.deadline_rule_sets enable row level security;

drop policy if exists "drs: select template or own" on public.deadline_rule_sets;
create policy "drs: select template or own" on public.deadline_rule_sets
  for select using (is_template or owner_id = auth.uid());

drop policy if exists "drs: insert own" on public.deadline_rule_sets;
create policy "drs: insert own" on public.deadline_rule_sets
  for insert with check (owner_id = auth.uid());

drop policy if exists "drs: update own" on public.deadline_rule_sets;
create policy "drs: update own" on public.deadline_rule_sets
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

insert into public.deadline_rule_sets (id, name, deadline_type, is_template)
values ('00000000-0000-0000-0002-000000000001', 'First Game of Day', 'first_game_of_day', true)
on conflict (id) do nothing;

-- ============================================================
-- STEP 5 — chip_rule_sets
-- ============================================================
create table if not exists public.chip_rule_sets (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  owner_id            uuid references auth.users(id),
  captain_enabled     boolean not null default true,
  captain_multiplier  numeric(4,2) not null default 2.0,
  wildcard_enabled    boolean not null default true,
  wildcard_count      int  not null default 1,
  all_star_enabled    boolean not null default false,
  all_star_count      int  not null default 1,
  all_star_multiplier numeric(4,2) not null default 2.0,
  reset_period        text not null default 'season'
                      check (reset_period in ('season','gameweek','phase')),
  is_template         boolean not null default false,
  created_at          timestamptz not null default now()
);

alter table public.chip_rule_sets enable row level security;

drop policy if exists "crs: select template or own" on public.chip_rule_sets;
create policy "crs: select template or own" on public.chip_rule_sets
  for select using (is_template or owner_id = auth.uid());

drop policy if exists "crs: insert own" on public.chip_rule_sets;
create policy "crs: insert own" on public.chip_rule_sets
  for insert with check (owner_id = auth.uid());

drop policy if exists "crs: update own" on public.chip_rule_sets;
create policy "crs: update own" on public.chip_rule_sets
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

insert into public.chip_rule_sets
  (id, name, captain_enabled, wildcard_enabled, all_star_enabled, is_template)
values
  ('00000000-0000-0000-0003-000000000001', 'Standard', true, true, false, true)
on conflict (id) do nothing;

-- ============================================================
-- STEP 6 — league_members
-- ============================================================
create table if not exists public.league_members (
  id        uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner','commissioner','member')),
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

alter table public.league_members enable row level security;

drop policy if exists "lm: select self or league owner" on public.league_members;
create policy "lm: select self or league owner" on public.league_members
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.leagues l where l.id = league_members.league_id and l.owner_id = auth.uid())
  );

drop policy if exists "lm: insert authenticated" on public.league_members;
create policy "lm: insert authenticated" on public.league_members
  for insert with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "lm: update by league owner" on public.league_members;
create policy "lm: update by league owner" on public.league_members
  for update using (
    exists (select 1 from public.leagues l where l.id = league_members.league_id and l.owner_id = auth.uid())
  );

drop policy if exists "lm: delete self or league owner" on public.league_members;
create policy "lm: delete self or league owner" on public.league_members
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from public.leagues l where l.id = league_members.league_id and l.owner_id = auth.uid())
  );

-- ============================================================
-- STEP 7 — FKs + Main League backfill + team_chips FK
-- ============================================================
do $$ begin
  alter table public.leagues add constraint leagues_rrs_fk
    foreign key (roster_rule_set_id) references public.roster_rule_sets(id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.leagues add constraint leagues_drs_fk
    foreign key (deadline_rule_set_id) references public.deadline_rule_sets(id);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.leagues add constraint leagues_crs_fk
    foreign key (chip_rule_set_id) references public.chip_rule_sets(id);
exception when duplicate_object then null; end $$;

update public.leagues set
  roster_rule_set_id   = coalesce(roster_rule_set_id,   '00000000-0000-0000-0001-000000000001'),
  deadline_rule_set_id = coalesce(deadline_rule_set_id, '00000000-0000-0000-0002-000000000001'),
  chip_rule_set_id     = coalesce(chip_rule_set_id,     '00000000-0000-0000-0003-000000000001')
where kind = 'fantasy';

do $$ begin
  alter table public.team_chips add constraint team_chips_league_fk
    foreign key (league_id) references public.leagues(id);
exception when duplicate_object then null; end $$;

-- ============================================================
-- STEP 8 — leagues RLS for user-created fantasy leagues
-- ============================================================
drop policy if exists "leagues: insert own fantasy" on public.leagues;
create policy "leagues: insert own fantasy" on public.leagues
  for insert with check (kind = 'fantasy' and owner_id = auth.uid());

drop policy if exists "leagues: update own fantasy" on public.leagues;
create policy "leagues: update own fantasy" on public.leagues
  for update using (kind = 'fantasy' and owner_id = auth.uid())
  with check (kind = 'fantasy' and owner_id = auth.uid());

drop policy if exists "leagues: delete own fantasy (draft only)" on public.leagues;
create policy "leagues: delete own fantasy (draft only)" on public.leagues
  for delete using (kind = 'fantasy' and owner_id = auth.uid() and status = 'draft');