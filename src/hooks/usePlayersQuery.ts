import { useQuery } from "@tanstack/react-query";
import { fetchPlayers } from "@/lib/api";
import { useLeague } from "@/contexts/LeagueContext";

export function usePlayersQuery(params?: {
  sort?: string; order?: string; limit?: number; offset?: number;
  fc_bc?: string; search?: string;
}) {
  const { league } = useLeague();
  return useQuery({
    queryKey: ["players", league, params],
    queryFn: () => fetchPlayers(params),
    staleTime: 60_000,
  });
}
