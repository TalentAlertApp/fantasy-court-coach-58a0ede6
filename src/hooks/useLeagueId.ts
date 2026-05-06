import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";

/**
 * Resolve the current sport league_id (NBA / WNBA) from the leagues table.
 * Cached per code via React Query.
 */
export function useLeagueId() {
  const { league } = useLeague();
  return useQuery({
    queryKey: ["league-id", league],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leagues")
        .select("id")
        .eq("code", league)
        .maybeSingle();
      if (error) throw error;
      return (data?.id as string | undefined) ?? null;
    },
    staleTime: 60 * 60_000,
  });
}