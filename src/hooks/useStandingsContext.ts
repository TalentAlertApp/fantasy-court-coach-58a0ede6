import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NBA_TEAM_META } from "@/data/nbaTeamsFallback";
import { useNBAStandings } from "@/hooks/useNBAStandings";
import type { StandingRow } from "@/types/standings";

interface SchedRow {
  home_team: string;
  away_team: string;
  home_pts: number;
  away_pts: number;
  status: string;
  tipoff_utc: string | null;
}

export interface Last5Detail {
  result: "W" | "L";
  opp: string;
  ownPts: number;
  oppPts: number;
  date: string | null;
}

const DIV_ABBR: Record<string, string> = {
  Atlantic: "Atl",
  Central: "Cen",
  Southeast: "SE",
  Northwest: "NW",
  Pacific: "Pac",
  Southwest: "SW",
};

async function fetchAllScheduleGames(): Promise<SchedRow[]> {
  // Paginate to bypass the 1k row default cap.
  const all: SchedRow[] = [];
  const PAGE = 1000;
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("schedule_games")
      .select("home_team,away_team,home_pts,away_pts,status,tipoff_utc")
      .order("tipoff_utc", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as SchedRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export function useStandingsContext() {
  const { data: games = [], isLoading } = useQuery({
    queryKey: ["standings-context-schedule"],
    queryFn: fetchAllScheduleGames,
    staleTime: 5 * 60_000,
  });

  const standings = useNBAStandings(games);

  const last5ByTeam = useMemo(() => {
    const finals = games
      .filter((g) => g.status?.toUpperCase().includes("FINAL"))
      .slice()
      .sort((a, b) => (a.tipoff_utc ?? "").localeCompare(b.tipoff_utc ?? ""));
    const map: Record<string, ("W" | "L")[]> = {};
    for (const g of finals) {
      const homeWon = g.home_pts > g.away_pts;
      (map[g.home_team] ||= []).push(homeWon ? "W" : "L");
      (map[g.away_team] ||= []).push(homeWon ? "L" : "W");
    }
    const out: Record<string, ("W" | "L")[]> = {};
    for (const [t, arr] of Object.entries(map)) {
      out[t] = arr.slice(-5);
    }
    return out;
  }, [games]);

  const last5DetailByTeam = useMemo(() => {
    const finals = games
      .filter((g) => g.status?.toUpperCase().includes("FINAL"))
      .slice()
      .sort((a, b) => (a.tipoff_utc ?? "").localeCompare(b.tipoff_utc ?? ""));
    const map: Record<string, Last5Detail[]> = {};
    for (const g of finals) {
      const homeWon = g.home_pts > g.away_pts;
      (map[g.home_team] ||= []).push({
        result: homeWon ? "W" : "L",
        opp: g.away_team,
        ownPts: g.home_pts,
        oppPts: g.away_pts,
        date: g.tipoff_utc,
      });
      (map[g.away_team] ||= []).push({
        result: homeWon ? "L" : "W",
        opp: g.home_team,
        ownPts: g.away_pts,
        oppPts: g.home_pts,
        date: g.tipoff_utc,
      });
    }
    const out: Record<string, Last5Detail[]> = {};
    for (const [t, arr] of Object.entries(map)) {
      out[t] = arr.slice(-5);
    }
    return out;
  }, [games]);

  const divisionRankByTeam = useMemo(() => {
    const byDiv: Record<string, StandingRow[]> = {};
    for (const r of standings) {
      const div = r.division;
      (byDiv[div] ||= []).push(r);
    }
    const out: Record<string, { rank: number; divLabel: string; ordinal: string }> = {};
    for (const [div, rows] of Object.entries(byDiv)) {
      rows.sort((a, b) => b.pct - a.pct || b.w - a.w || a.l - b.l);
      rows.forEach((r, i) => {
        const rank = i + 1;
        const ordinal =
          rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `${rank}th`;
        out[r.tricode] = {
          rank,
          divLabel: DIV_ABBR[div] ?? div.slice(0, 3),
          ordinal,
        };
      });
    }
    return out;
  }, [standings]);

  const standingsByTeam = useMemo(() => {
    const m: Record<string, StandingRow> = {};
    for (const r of standings) m[r.tricode] = r;
    return m;
  }, [standings]);

  return { standings, standingsByTeam, last5ByTeam, last5DetailByTeam, divisionRankByTeam, isLoading };
}
