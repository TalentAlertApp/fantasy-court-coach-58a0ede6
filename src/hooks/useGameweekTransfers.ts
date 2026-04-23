import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Counts how many SWAP transactions the team has already committed for the
 * given gameweek. Source of truth: the `transactions` table — committed trades
 * are stamped with `notes = "gw=<N> day=<D>"` by transactions-commit.
 *
 * Each row represents one OUT/IN pair (one "trade"). Cap = 2 trades / GW.
 */
export function useGameweekTransfers(teamId: string | null | undefined, gw: number) {
  return useQuery({
    queryKey: ["gw-transfers", teamId, gw],
    enabled: !!teamId && Number.isFinite(gw) && gw > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, notes, created_at")
        .eq("team_id", teamId!)
        .like("notes", `gw=${gw}%`);
      if (error) throw error;
      const used = (data ?? []).length;
      return {
        used,
        remaining: Math.max(0, 2 - used),
        cap: 2,
      };
    },
  });
}