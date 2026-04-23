import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase-config";

export interface LeagueStandingRow {
  rank: number;
  team_id: string;
  team_name: string;
  owner_id: string;
  owner_label: string;
  total_fp: number;
  current_week_fp: number;
  latest_day_fp: number;
  avg_fp_per_gw: number;
  best_week_fp: number;
  worst_week_fp: number;
  updated_at: string;
}

export interface LeagueStandingsData {
  league_id: string;
  current_gw: number;
  teams: LeagueStandingRow[];
  summary: {
    total_teams: number;
    league_leader: { team_name: string; owner_label: string; total_fp: number } | null;
    best_this_week: { team_name: string; owner_label: string; current_week_fp: number } | null;
    highest_single_week: { team_name: string; owner_label: string; best_week_fp: number } | null;
  };
}

async function fetchLeagueStandings(leagueId?: string): Promise<LeagueStandingsData> {
  const qs = leagueId ? `?league_id=${leagueId}` : "";
  const res = await fetch(`${SUPABASE_URL}/functions/v1/league-standings${qs}`, {
    headers: { "Content-Type": "application/json", apikey: SUPABASE_PUBLISHABLE_KEY },
  });
  if (!res.ok) throw new Error(`league-standings ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message || "Failed");
  return json.data;
}

export function useLeagueStandings(leagueId?: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["league-standings", leagueId ?? "main"],
    queryFn: () => fetchLeagueStandings(leagueId),
    staleTime: 60_000,
  });

  // Realtime invalidation — any roster or transactions change anywhere in the
  // league refreshes standings within seconds without a hard refetch on every
  // mount.
  useEffect(() => {
    const channel = supabase
      .channel("league-standings-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "roster" }, () => {
        queryClient.invalidateQueries({ queryKey: ["league-standings"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => {
        queryClient.invalidateQueries({ queryKey: ["league-standings"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
}
