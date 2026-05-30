import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeagueId } from "@/hooks/useLeagueId";

/**
 * Returns the set of `day` values within the given gameweek that currently
 * have at least one LIVE game. Refreshes frequently so the schedule day-rail
 * can pulse the truly-active day (gamedays can run past midnight Lisbon).
 */
export function useScheduleWeekLive(gw: number) {
  const { data: leagueId } = useLeagueId();
  return useQuery({
    queryKey: ["schedule-week-live", gw, leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("day, status")
        .eq("league_id", leagueId!)
        .eq("gw", gw);
      if (error) throw error;
      const live = new Set<number>();
      for (const row of data ?? []) {
        const s = String(row.status ?? "").toUpperCase();
        if (s.includes("LIVE") && !s.includes("FINAL")) live.add(row.day);
      }
      return live;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}