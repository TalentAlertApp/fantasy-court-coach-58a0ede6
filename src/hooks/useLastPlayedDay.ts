import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeagueId } from "@/hooks/useLeagueId";

export function useLastPlayedDay() {
  const { data: leagueId } = useLeagueId();
  return useQuery({
    queryKey: ["last-played-day", leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("gw, day")
        .eq("league_id", leagueId!)
        .ilike("status", "%FINAL%")
        .order("gw", { ascending: false })
        .order("day", { ascending: false })
        .limit(1);
      if (error) throw error;
      if (!data || data.length === 0) return null;
      return { gw: data[0].gw, day: data[0].day };
    },
    staleTime: 60_000,
  });
}
