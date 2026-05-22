import { useLeague } from "@/contexts/LeagueContext";
import { DEADLINES, type Deadline } from "@/lib/deadlines";
import { WNBA_DEADLINES } from "@/lib/wnba-deadlines";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

const EUROLEAGUE_LEAGUE_ID = "00000000-0000-0000-0000-000000000003";

/**
 * Format a UTC instant into a Lisbon YYYY-MM-DD string. EuroLeague tipoffs
 * are authored in Lisbon time already (per data ops), but the DB stores them
 * as UTC — converting back to Lisbon avoids midnight-crossing drift.
 */
function toLisbonDate(utc: string): string {
  const d = new Date(utc);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "";
  const m = parts.find((p) => p.type === "month")?.value ?? "";
  const da = parts.find((p) => p.type === "day")?.value ?? "";
  return `${y}-${m}-${da}`;
}

function useEuroLeagueDeadlines() {
  const { data, isLoading } = useQuery({
    queryKey: ["euroleague-deadlines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("gw, day, tipoff_utc")
        .eq("league_id", EUROLEAGUE_LEAGUE_ID)
        .not("tipoff_utc", "is", null)
        .order("tipoff_utc", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as { gw: number; day: number; tipoff_utc: string }[];
    },
    staleTime: 5 * 60_000,
  });

  const deadlines = useMemo<Deadline[]>(() => {
    if (!data?.length) return [];
    const firstByKey = new Map<string, string>();
    for (const g of data) {
      const key = `${g.gw}-${g.day}`;
      const prev = firstByKey.get(key);
      if (!prev || new Date(g.tipoff_utc).getTime() < new Date(prev).getTime()) {
        firstByKey.set(key, g.tipoff_utc);
      }
    }
    const rows: (Deadline & { date: string })[] = [];
    for (const [key, tip] of firstByKey) {
      const [gw, day] = key.split("-").map(Number);
      const deadlineMs = new Date(tip).getTime() - 30 * 60_000;
      rows.push({
        gw,
        day,
        deadline_utc: new Date(deadlineMs).toISOString(),
        date: toLisbonDate(tip),
      });
    }
    rows.sort((a, b) => a.gw - b.gw || a.day - b.day);
    return rows;
  }, [data]);

  return { deadlines, isLoading };
}

/**
 * Returns the deadline list for the active league.
 * Both leagues use static, hand-maintained Lisbon-time deadline tables
 * (NBA: DEADLINES, WNBA: WNBA_DEADLINES). Each WNBA entry stores the Lisbon
 * `date` + `deadline_local` and the resolved `deadline_utc`; lock evaluation
 * always compares the full UTC instant against `Date.now()`.
 */
export function useLeagueDeadlines() {
  const { league } = useLeague();
  const euro = useEuroLeagueDeadlines();
  if (league === "euroleague") {
    return euro;
  }
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