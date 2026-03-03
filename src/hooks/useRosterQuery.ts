import { useQuery } from "@tanstack/react-query";
import { fetchRosterCurrent } from "@/lib/api";

export function useRosterQuery() {
  return useQuery({
    queryKey: ["roster-current"],
    queryFn: fetchRosterCurrent,
    staleTime: 30_000,
  });
}
