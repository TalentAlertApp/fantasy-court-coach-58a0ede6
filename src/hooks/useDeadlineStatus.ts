import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DeadlineStatus {
  locked: boolean;
  reason: string | null;
  nextDeadline: string | null;
  transferAllowed: boolean;
  transferReason: string | null;
  now: string;
}

/**
 * Polls the deadline-status edge function every 60s for the given team.
 * Returns lineup + transfer lock state derived from the league's deadline_rule_set.
 */
export function useDeadlineStatus(teamId?: string | null) {
  return useQuery<DeadlineStatus>({
    queryKey: ["deadline-status", teamId ?? "none"],
    enabled: !!teamId,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("deadline-status", {
        method: "GET" as any,
        // edge function reads team_id from query string
        body: undefined,
        headers: {},
        // @ts-expect-error – supabase-js v2 supports query via path append
      });
      if (error) throw error;
      const payload = (data?.data ?? data) as any;
      return {
        locked: !!payload?.locked,
        reason: payload?.reason ?? null,
        nextDeadline: payload?.nextDeadline ?? null,
        transferAllowed: !!payload?.transfer?.allowed,
        transferReason: payload?.transfer?.reason ?? null,
        now: payload?.now ?? new Date().toISOString(),
      };
    },
  });
}