import { useQuery } from "@tanstack/react-query";
import { useTeam } from "@/contexts/TeamContext";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase-config";

export interface ScoringPlayer {
  player_id: number;
  name: string;
  team: string;
  fc_bc: "FC" | "BC";
  photo: string | null;
  opp: string;
  home_away: string;
  result_wl: string;
  fp: number;
  salary: number;
  value: number;
  mp: number;
  pts: number;
  ast: number;
  reb: number;
  blk: number;
  stl: number;
  nba_game_url: string | null;
  is_starter: boolean;
}

export interface ScoringGameDay {
  gw: number;
  day: number;
  game_date: string;
  total_fp: number;
  players: ScoringPlayer[];
}

export interface ScoringWeek {
  gw: number;
  total_fp: number;
  best_player: { name: string; fp: number; player_id: number; photo?: string | null } | null;
  worst_player: { name: string; fp: number; player_id: number; photo?: string | null } | null;
  captain_bonus: number;
}

export interface ScoringHistoryData {
  weeks: ScoringWeek[];
  game_days: ScoringGameDay[];
  transactions: any[];
  captain_id: number | null;
}

async function fetchScoringHistory(teamId: string): Promise<ScoringHistoryData> {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/scoring-history?team_id=${teamId}`,
    {
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`scoring-history ${res.status}: ${text}`);
  }
  const ct = res.headers.get("content-type") || "";
  const raw = await res.text();
  if (!ct.includes("application/json") && !raw.trimStart().startsWith("{")) {
    throw new Error(`scoring-history returned non-JSON (content-type=${ct})`);
  }
  const json = JSON.parse(raw);
  if (!json.ok) throw new Error(json.error?.message || "Failed to fetch scoring history");
  return json.data;
}

export function useScoringHistory() {
  const { selectedTeamId, isReady } = useTeam();
  return useQuery({
    queryKey: ["scoring-history", selectedTeamId],
    queryFn: () => fetchScoringHistory(selectedTeamId!),
    enabled: isReady && !!selectedTeamId,
    staleTime: 60_000,
  });
}
