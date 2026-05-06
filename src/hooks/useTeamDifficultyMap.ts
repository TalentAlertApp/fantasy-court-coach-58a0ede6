import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildTeamDifficultyMap } from "@/lib/ballers-iq/teamDifficulty";
import type { BIQGame, BIQTeamDifficulty } from "@/lib/ballers-iq/types";

/**
 * Loads finalized schedule games and computes each team's matchup-difficulty
 * once. Cached for 5 minutes — purely client-side derivation.
 */
export function useTeamDifficultyMap() {
  return useQuery<Record<string, BIQTeamDifficulty>>({
    queryKey: ["team-difficulty-map"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("game_id, home_team, away_team, home_pts, away_pts, status, tipoff_utc")
        .ilike("status", "%FINAL%")
        .order("tipoff_utc", { ascending: true });
      if (error) throw error;
      const games: BIQGame[] = (data ?? []).map((g: any) => ({
        game_id: g.game_id,
        home_team: g.home_team,
        away_team: g.away_team,
        home_pts: g.home_pts,
        away_pts: g.away_pts,
        status: g.status,
        tipoff_utc: g.tipoff_utc,
      }));
      return buildTeamDifficultyMap(games);
    },
  });
}