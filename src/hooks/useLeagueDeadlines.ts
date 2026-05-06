import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueId } from "@/hooks/useLeagueId";
import { DEADLINES, type Deadline } from "@/lib/deadlines";

/**
 * Returns the deadline list for the active league.
 * - NBA: hard-coded static DEADLINES (unchanged).
 * - WNBA: derived from schedule_games — earliest tipoff per (gw, day) becomes
 *   the lock time. Lisbon is the canonical timezone (TSV times are already
 *   Europe/Lisbon, but stored as UTC in DB).
 */
export function useLeagueDeadlines() {
  const { league } = useLeague();
  const { data: leagueId } = useLeagueId();

  const q = useQuery({
    queryKey: ["league-deadlines", league, leagueId],
    enabled: league === "wnba" && !!leagueId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Deadline[]> => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("gw, day, tipoff_utc")
        .eq("league_id", leagueId!)
        .order("gw", { ascending: true })
        .order("day", { ascending: true });
      if (error) throw error;
      const earliest = new Map<string, string>();
      for (const r of data ?? []) {
        if (!r.tipoff_utc) continue;
        const k = `${r.gw}-${r.day}`;
        const cur = earliest.get(k);
        if (!cur || new Date(r.tipoff_utc) < new Date(cur)) earliest.set(k, r.tipoff_utc);
      }
      const out: Deadline[] = [];
      for (const [k, iso] of earliest) {
        const [gw, day] = k.split("-").map(Number);
        out.push({ gw, day, deadline_utc: iso });
      }
      out.sort((a, b) => a.gw - b.gw || a.day - b.day);
      return out;
    },
  });

  if (league === "nba") {
    return { deadlines: DEADLINES, isLoading: false };
  }
  return { deadlines: q.data ?? [], isLoading: q.isLoading };
}

export function getCurrentGamedayFrom(deadlines: Deadline[]): Deadline | null {
  if (deadlines.length === 0) return null;
  const now = new Date();
  return deadlines.find((d) => new Date(d.deadline_utc) > now) ?? deadlines[deadlines.length - 1];
}