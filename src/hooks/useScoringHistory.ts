import { useQuery } from "@tanstack/react-query";
import { useTeam } from "@/contexts/TeamContext";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

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
  best_player: { name: string; fp: number; player_id: number } | null;
  worst_player: { name: string; fp: number; player_id: number } | null;
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
        apikey: ANON_KEY,
      },
    }
  );
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message || "Failed to fetch scoring history");
  return json.data;
}

export function useScoringHistory() {
  const { selectedTeamId } = useTeam();
  return useQuery({
    queryKey: ["scoring-history", selectedTeamId],
    queryFn: () => fetchScoringHistory(selectedTeamId!),
    enabled: !!selectedTeamId,
    staleTime: 60_000,
  });
}
