import { useQuery } from "@tanstack/react-query";
import { fetchRosterCurrent } from "@/lib/api";
import { useTeam } from "@/contexts/TeamContext";

export function useRosterQuery() {
  const { selectedTeamId } = useTeam();
  return useQuery({
    queryKey: ["roster-current", selectedTeamId],
    queryFn: () => fetchRosterCurrent(selectedTeamId ?? undefined),
    staleTime: 30_000,
    enabled: !!selectedTeamId,
  });
}
