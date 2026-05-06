import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueId } from "@/hooks/useLeagueId";

/**
 * Returns `true` while the active league has NO completed games yet
 * (i.e. pre-season). Cheap probe: any player_game_logs row for the league.
 */
export function useIsPreseason() {
  const { league } = useLeague();
  const { data: leagueId } = useLeagueId();
  return useQuery({
    queryKey: ["is-preseason", league, leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("player_game_logs")
        .select("id", { count: "exact", head: true })
        .eq("league_id", leagueId as string);
      if (error) return false;
      return (count ?? 0) === 0;
    },
    staleTime: 5 * 60_000,
  });
}