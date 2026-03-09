import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useScheduleWeekCounts(gw: number) {
  return useQuery({
    queryKey: ["schedule-week-counts", gw],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("day")
        .eq("gw", gw);
      if (error) throw error;
      const counts: Record<number, number> = {};
      for (const row of data ?? []) {
        counts[row.day] = (counts[row.day] || 0) + 1;
      }
      return counts;
    },
    staleTime: 300_000,
  });
}
