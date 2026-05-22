import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const MAIN_LEAGUE_ID = "00000000-0000-0000-0000-000000000010";
export const MAIN_LEAGUE_NBA_ID = "00000000-0000-0000-0000-000000000010";
export const MAIN_LEAGUE_WNBA_ID = "00000000-0000-0000-0000-000000000020";
export const MAIN_LEAGUE_EUROLEAGUE_ID = "00000000-0000-0000-0000-000000000030";
export const MAIN_LEAGUE_IDS = new Set<string>([
  MAIN_LEAGUE_NBA_ID,
  MAIN_LEAGUE_WNBA_ID,
  MAIN_LEAGUE_EUROLEAGUE_ID,
]);
export function isMainLeague(id: string): boolean {
  return MAIN_LEAGUE_IDS.has(id);
}

export type RosterRuleSet = {
  id: string;
  name: string;
  total_players: number;
  starters_count: number;
  bench_count: number;
  fc_slots: number;
  bc_slots: number;
  budget_cap: number | null;
  max_players_per_team: number | null;
  is_template: boolean;
};

export type DeadlineRuleSet = {
  id: string;
  name: string;
  deadline_type: "first_game_of_day" | "per_player_game_lock" | "fixed_weekly" | "manual";
  timezone: string;
  minutes_before_game: number;
  fixed_weekday: number | null;
  fixed_time: string | null;
  is_template: boolean;
};

export type ChipRuleSet = {
  id: string;
  name: string;
  captain_enabled: boolean;
  captain_multiplier: number;
  wildcard_enabled: boolean;
  wildcard_count: number;
  all_star_enabled: boolean;
  all_star_count: number;
  all_star_multiplier: number;
  reset_period: "season" | "gameweek" | "phase";
  is_template: boolean;
};

export type ScoringSystem = {
  id: string;
  code: string;
  name: string;
  sport: string;
  is_active: boolean;
  is_template: boolean;
};

export type ScoringRule = {
  stat_key: string;
  rule_type: string;
  weight: number;
  applies_to: string;
  is_active: boolean;
};

export type FantasyLeague = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  sport: "nba" | "wnba" | "euroleague";
  visibility: string;
  status: string;
  join_code: string | null;
  owner_id: string | null;
  transfer_cap: number;
  max_teams: number;
  rosterRules: RosterRuleSet | null;
  deadlineRules: DeadlineRuleSet | null;
  chipRules: ChipRuleSet | null;
  scoringSystem: ScoringSystem | null;
  scoringRules: ScoringRule[];
  memberCount: number;
  myTeamCount: number;
};

async function fetchFantasyLeagues(userId: string | null): Promise<FantasyLeague[]> {
  // 1. Pull all fantasy leagues with rule sets + scoring system inlined
  const { data: rawLeagues, error: lErr } = await supabase
    .from("leagues")
    .select(`
      id, name, description, kind, sport, visibility, status, join_code,
      owner_id, transfer_cap, max_teams, scoring_system_id,
      roster_rule_set_id, deadline_rule_set_id, chip_rule_set_id,
      rosterRules:roster_rule_sets!leagues_rrs_fk(*),
      deadlineRules:deadline_rule_sets!leagues_drs_fk(*),
      chipRules:chip_rule_sets!leagues_crs_fk(*),
      scoringSystem:scoring_systems!leagues_scoring_system_id_fkey(*)
    `)
    .eq("kind", "fantasy");
  if (lErr) throw lErr;

  let leagues = (rawLeagues ?? []) as any[];

  // 2. Filter to leagues this user can access
  if (userId) {
    const [{ data: myTeams }, { data: myMemberships }] = await Promise.all([
      supabase.from("teams").select("league_id").eq("owner_id", userId),
      supabase.from("league_members").select("league_id").eq("user_id", userId),
    ]);
    const teamLeagueIds = new Set((myTeams ?? []).map((t: any) => t.league_id));
    const memberLeagueIds = new Set((myMemberships ?? []).map((m: any) => m.league_id));
    leagues = leagues.filter(
      (l) =>
        MAIN_LEAGUE_IDS.has(l.id) ||
        l.owner_id === userId ||
        teamLeagueIds.has(l.id) ||
        memberLeagueIds.has(l.id),
    );
  } else {
    leagues = leagues.filter((l) => MAIN_LEAGUE_IDS.has(l.id));
  }

  // 3. Pull scoring rules + counts
  const systemIds = Array.from(new Set(leagues.map((l) => l.scoring_system_id).filter(Boolean)));
  const leagueIds = leagues.map((l) => l.id);

  const [rulesRes, membersRes, teamsRes] = await Promise.all([
    systemIds.length
      ? supabase
          .from("scoring_rules")
          .select("scoring_system_id, stat_key, rule_type, weight, applies_to, is_active")
          .in("scoring_system_id", systemIds)
          .eq("is_active", true)
      : Promise.resolve({ data: [], error: null } as any),
    leagueIds.length
      ? supabase.from("league_members").select("league_id").in("league_id", leagueIds)
      : Promise.resolve({ data: [], error: null } as any),
    userId && leagueIds.length
      ? supabase
          .from("teams")
          .select("league_id")
          .eq("owner_id", userId)
          .in("league_id", leagueIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  const rulesBySystem = new Map<string, ScoringRule[]>();
  for (const r of (rulesRes.data ?? []) as any[]) {
    const arr = rulesBySystem.get(r.scoring_system_id) ?? [];
    arr.push({
      stat_key: r.stat_key, rule_type: r.rule_type,
      weight: Number(r.weight), applies_to: r.applies_to, is_active: r.is_active,
    });
    rulesBySystem.set(r.scoring_system_id, arr);
  }
  const memberCounts = new Map<string, number>();
  for (const m of (membersRes.data ?? []) as any[]) {
    memberCounts.set(m.league_id, (memberCounts.get(m.league_id) ?? 0) + 1);
  }
  const myTeamCounts = new Map<string, number>();
  for (const t of (teamsRes.data ?? []) as any[]) {
    myTeamCounts.set(t.league_id, (myTeamCounts.get(t.league_id) ?? 0) + 1);
  }

  return leagues.map((l) => ({
    id: l.id,
    name: l.name,
    description: l.description ?? null,
    kind: l.kind,
    sport: (l.sport === "wnba" ? "wnba" : l.sport === "euroleague" ? "euroleague" : "nba") as "nba" | "wnba" | "euroleague",
    visibility: l.visibility,
    status: l.status,
    join_code: l.join_code ?? null,
    owner_id: l.owner_id ?? null,
    transfer_cap: l.transfer_cap ?? 2,
    max_teams: l.max_teams ?? 20,
    rosterRules: l.rosterRules ?? null,
    deadlineRules: l.deadlineRules ?? null,
    chipRules: l.chipRules ?? null,
    scoringSystem: l.scoringSystem ?? null,
    scoringRules: rulesBySystem.get(l.scoring_system_id) ?? [],
    memberCount: memberCounts.get(l.id) ?? 0,
    myTeamCount: myTeamCounts.get(l.id) ?? 0,
  }));
}

export function useFantasyLeagues() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["fantasy-leagues", user?.id ?? null],
    queryFn: () => fetchFantasyLeagues(user?.id ?? null),
    staleTime: 60_000,
  });
}