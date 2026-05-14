import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeagueId } from "@/hooks/useLeagueId";
import { useLeague } from "@/contexts/LeagueContext";
import { useTeam } from "@/contexts/TeamContext";

/**
 * For the given player ids, fetch their player_game_logs in the active league
 * and return a lookup keyed by player_id → game_id → { fp, mp, pts }.
 * Used to surface played-game FP on the roster opponent badges.
 */
export function useRosterPlayerLogs(playerIds: number[]) {
  const { selectedTeamId } = useTeam();
  const { league } = useLeague();
  const { data: leagueId } = useLeagueId();
  const ids = Array.from(new Set(playerIds.filter((n) => Number.isFinite(n) && n > 0))).sort((a, b) => a - b);
  const key = ids.join(",");
  return useQuery({
    queryKey: ["roster-player-logs", selectedTeamId, league, leagueId, key],
    enabled: !!leagueId && ids.length > 0,
    staleTime: 120_000,
    queryFn: async (): Promise<Record<number, Record<string, { fp: number; mp: number; pts: number }>>> => {
      const { data, error } = await supabase
        .from("player_game_logs")
        .select("player_id, game_id, fp, mp, pts")
        .eq("league_id", leagueId!)
        .in("player_id", ids);
      if (error) throw error;
      const map: Record<number, Record<string, { fp: number; mp: number; pts: number }>> = {};
      for (const r of data ?? []) {
        const pid = Number(r.player_id);
        if (!map[pid]) map[pid] = {};
        map[pid][String(r.game_id)] = {
          fp: Number(r.fp ?? 0),
          mp: Number(r.mp ?? 0),
          pts: Number(r.pts ?? 0),
        };
      }
      return map;
    },
  });
}