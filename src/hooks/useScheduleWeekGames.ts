import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeagueId } from "@/hooks/useLeagueId";
import { useLeague } from "@/contexts/LeagueContext";
import { useTeam } from "@/contexts/TeamContext";

export interface ScheduleWeekGame {
  game_id: string;
  gw: number;
  day: number;
  home_team: string;
  away_team: string;
  status: string;
  home_pts: number;
  away_pts: number;
  tipoff_utc: string | null;
}

export function useScheduleWeekGames(gw: number) {
  const { selectedTeamId } = useTeam();
  const { league } = useLeague();
  const { data: leagueId } = useLeagueId();
  return useQuery({
    queryKey: ["schedule-week-games", selectedTeamId, league, leagueId, gw],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("game_id, gw, day, home_team, away_team, status, home_pts, away_pts, tipoff_utc")
        .eq("league_id", leagueId!)
        .eq("gw", gw);
      if (error) throw error;
      return (data ?? []) as ScheduleWeekGame[];
    },
    staleTime: 300_000,
  });
}
