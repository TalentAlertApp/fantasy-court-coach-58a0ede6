import { useQuery } from "@tanstack/react-query";
import { fetchGameBoxscore } from "@/lib/api";

export function useGameBoxscoreQuery(gameId: string | null) {
  return useQuery({
    queryKey: ["game-boxscore", gameId],
    queryFn: () => fetchGameBoxscore(gameId!),
    enabled: !!gameId,
    staleTime: 5 * 60 * 1000,
  });
}
