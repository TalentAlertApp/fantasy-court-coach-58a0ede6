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
  on public.scoring_daily_team_totals for select
  using (true);

create index idx_sdtt_team_gw_day on public.scoring_daily_team_totals (team_id, gw, day);
create index idx_sdtt_league_gw   on public.scoring_daily_team_totals (fantasy_league_id, gw);