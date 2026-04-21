import { useQuery } from "@tanstack/react-query";
import { fetchRosterCurrent } from "@/lib/api";
import { useTeam } from "@/contexts/TeamContext";

export function useRosterQuery() {
  const { selectedTeamId, isReady, teams } = useTeam();
  // Only fire when the selected id actually exists in the loaded teams list.
  // This prevents a stale localStorage id from being sent to the edge fn
  // during the brief window before TeamContext finishes auto-correcting.
  const idIsValid = !!selectedTeamId && teams.some((t: any) => t.id === selectedTeamId);
  return useQuery({
    queryKey: ["roster-current", selectedTeamId],
    queryFn: () => fetchRosterCurrent(selectedTeamId ?? undefined),
    staleTime: 30_000,
    enabled: isReady && idIsValid,
  });
}
