import { useQuery } from "@tanstack/react-query";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase-config";

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
      const url = `${SUPABASE_URL}/functions/v1/deadline-status?team_id=${encodeURIComponent(teamId!)}`;
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", apikey: SUPABASE_PUBLISHABLE_KEY },
      });
      if (!res.ok) throw new Error(`deadline-status ${res.status}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message || "Failed");
      const payload = json.data ?? {};
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