import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLastPlayedDay() {
  return useQuery({
    queryKey: ["last-played-day"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("gw, day")
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
