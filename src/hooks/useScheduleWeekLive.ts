import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeagueId } from "@/hooks/useLeagueId";

/** Real in-progress statuses from the source sheet (e.g. "Q1 5:29", "HALF",
 *  "OT 2:14"). Mirrors the predicate used by the schedule game cards so the
 *  day-rail dot and the cards agree on what "live" means. */
function isLiveStatusString(s: string): boolean {
  const u = s.toUpperCase().trim();
  if (!u) return false;
  if (u === "LIVE" || u === "IN_PROGRESS") return true;
  return /^(Q[1-4]|END|HALF|OT|DELAY)/.test(u);
}

/** Live window heuristic: the server status does not flip to LIVE in real time,
 *  so we treat a SCHEDULED game as live from tipoff until tipoff + 2h30m. This
 *  matches ScheduleList.isGameLive so the day rail tracks the same slate. */
const LIVE_WINDOW_MS = 2.5 * 60 * 60 * 1000;
function isGameLive(status: string, tipoff_utc: string | null, nowMs: number): boolean {
  const s = (status ?? "").toUpperCase();
  if (isLiveStatusString(s)) return true;
  if (s.includes("FINAL")) return false;
  if (!tipoff_utc) return false;
  const t = new Date(tipoff_utc).getTime();
  if (!Number.isFinite(t)) return false;
  return nowMs >= t && nowMs < t + LIVE_WINDOW_MS;
}

/**
 * Returns the set of `day` values within the given gameweek that currently
 * have at least one LIVE game. Refreshes frequently so the schedule day-rail
 * can pulse the truly-active day (gamedays can run past midnight Lisbon).
 *
 * "Live" matches the schedule cards exactly: an explicit in-progress status OR
 * a scheduled game whose tipoff has passed and is still inside the live window.
 */
export function useScheduleWeekLive(gw: number) {
  const { data: leagueId } = useLeagueId();
  return useQuery({
    queryKey: ["schedule-week-live", gw, leagueId],
    enabled: !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("day, status, tipoff_utc")
        .eq("league_id", leagueId!)
        .eq("gw", gw);
      if (error) throw error;
      const nowMs = Date.now();
      const live = new Set<number>();
      for (const row of data ?? []) {
        if (isGameLive(String(row.status ?? ""), row.tipoff_utc ?? null, nowMs)) {
          live.add(row.day);
        }
      }
      return live;
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}