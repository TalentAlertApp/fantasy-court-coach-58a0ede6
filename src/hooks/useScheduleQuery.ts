import { useQuery } from "@tanstack/react-query";
import { fetchSchedule } from "@/lib/api";

export function useScheduleQuery(params?: { gw?: number; day?: number }) {
  return useQuery({
    queryKey: ["schedule", params],
    queryFn: () => fetchSchedule(params),
    staleTime: 60_000,
  });
}
