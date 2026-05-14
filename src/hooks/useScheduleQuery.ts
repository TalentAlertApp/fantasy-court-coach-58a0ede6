import { useQuery } from "@tanstack/react-query";
import { fetchSchedule } from "@/lib/api";
import { useLeague } from "@/contexts/LeagueContext";

export function useScheduleQuery(params?: { gw?: number; day?: number }) {
  const { league } = useLeague();
  return useQuery({
    queryKey: ["schedule", league, params],
    queryFn: () => fetchSchedule(params),
    staleTime: 60_000,
  });
}
