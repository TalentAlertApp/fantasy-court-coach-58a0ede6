import { useQuery } from "@tanstack/react-query";
import { fetchPlayers } from "@/lib/api";

export function usePlayersQuery(params?: {
  sort?: string; order?: string; limit?: number; offset?: number;
  fc_bc?: string; search?: string;
}) {
  return useQuery({
    queryKey: ["players", params],
    queryFn: () => fetchPlayers(params),
    staleTime: 60_000,
  });
}
