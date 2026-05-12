import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UsedChip {
  chip: "all_star" | "wildcard";
  gw: number;
  used_at: string;
}

/** Returns the chips (all_star / wildcard) the team has already consumed. */
export function useTeamChips(teamId?: string | null) {
  return useQuery({
    queryKey: ["team-chips", teamId ?? "none"],
    enabled: !!teamId,
    queryFn: async (): Promise<UsedChip[]> => {
      const { data, error } = await supabase
        .from("team_chips")
        .select("chip, gw, used_at")
        .eq("team_id", teamId!);
      if (error) throw error;
      return (data ?? []) as UsedChip[];
    },
    staleTime: 30_000,
  });
}