import { useLeague } from "@/contexts/LeagueContext";
import { DEADLINES, type Deadline } from "@/lib/deadlines";
import { WNBA_DEADLINES } from "@/lib/wnba-deadlines";

/**
 * Returns the deadline list for the active league.
 * Both leagues use static, hand-maintained Lisbon-time deadline tables
 * (NBA: DEADLINES, WNBA: WNBA_DEADLINES). Each WNBA entry stores the Lisbon
 * `date` + `deadline_local` and the resolved `deadline_utc`; lock evaluation
 * always compares the full UTC instant against `Date.now()`.
 */
export function useLeagueDeadlines() {
  const { league } = useLeague();
  if (league === "wnba") {
    return { deadlines: WNBA_DEADLINES as Deadline[], isLoading: false };
  }
  return { deadlines: DEADLINES, isLoading: false };
}

export function getCurrentGamedayFrom(deadlines: Deadline[]): Deadline | null {
  if (deadlines.length === 0) return null;
  const now = new Date();
  return deadlines.find((d) => new Date(d.deadline_utc) > now) ?? deadlines[deadlines.length - 1];
}