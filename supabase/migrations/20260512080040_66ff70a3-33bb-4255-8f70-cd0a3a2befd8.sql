create table public.team_chips (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  league_id uuid not null,
  gw int not null,
  chip text not null check (chip in ('all_star','wildcard')),
  used_at timestamptz not null default now(),
  unique (team_id, chip)
);
alter table public.team_chips enable row level security;

create policy "team_chips: select own" on public.team_chips
  for select using (exists (select 1 from public.teams t where t.id = team_chips.team_id and t.owner_id = auth.uid()));

create policy "team_chips: insert own" on public.team_chips
  for insert with check (exists (select 1 from public.teams t where t.id = team_chips.team_id and t.owner_id = auth.uid()));

create policy "team_chips: delete own" on public.team_chips
  for delete using (exists (select 1 from public.teams t where t.id = team_chips.team_id and t.owner_id = auth.uid()));

create index team_chips_team_idx on public.team_chips(team_id);