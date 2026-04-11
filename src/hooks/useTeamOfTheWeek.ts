import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEADLINES } from "@/lib/deadlines";

export interface TOTWPlayer {
  id: number;
  name: string;
  team: string;
  photo: string | null;
  fc_bc: string;
  fp_avg: number;
  gp: number;
}

function getGwDateRange(gw: number): { start: string; end: string } | null {
  const gwDeadlines = DEADLINES.filter((d) => d.gw === gw);
  if (gwDeadlines.length === 0) return null;
  const firstDt = new Date(gwDeadlines[0].deadline_utc);
  const lastDt = new Date(gwDeadlines[gwDeadlines.length - 1].deadline_utc);
  // Go 1 day before first deadline for start
  firstDt.setDate(firstDt.getDate() - 1);
  return {
    start: firstDt.toISOString().slice(0, 10),
    end: lastDt.toISOString().slice(0, 10),
  };
}

function pickTop5WithPositionConstraint(candidates: TOTWPlayer[]): TOTWPlayer[] {
  // Must have at least 2 FC and 2 BC in the final 5
  const sorted = [...candidates].sort((a, b) => b.fp_avg - a.fp_avg);
  
  const result: TOTWPlayer[] = [];
  const fcPicked: TOTWPlayer[] = [];
  const bcPicked: TOTWPlayer[] = [];
  
  // First pass: greedily pick top players but ensure we reserve slots
  for (const p of sorted) {
    if (result.length >= 5) break;
    
    const remaining = 5 - result.length;
    const fcNeeded = Math.max(0, 2 - fcPicked.length);
    const bcNeeded = Math.max(0, 2 - bcPicked.length);
    
    if (p.fc_bc === "FC") {
      // Can we still satisfy BC minimum if we take this FC?
      if (remaining - 1 >= bcNeeded) {
        result.push(p);
        fcPicked.push(p);
      }
    } else {
      // Can we still satisfy FC minimum if we take this BC?
      if (remaining - 1 >= fcNeeded) {
        result.push(p);
        bcPicked.push(p);
      }
    }
  }
  
  return result;
}

export function useTeamOfTheWeek(gw: number) {
  return useQuery({
    queryKey: ["team-of-the-week", gw],
    queryFn: async () => {
      const range = getGwDateRange(gw);
      if (!range) return { players: [], gw };

      // Get game logs for this GW date range
      const { data: logs, error: logsErr } = await supabase
        .from("player_game_logs")
        .select("player_id, fp, game_date")
        .gte("game_date", range.start)
        .lte("game_date", range.end)
        .gt("fp", 0);

      if (logsErr) throw logsErr;

      // Aggregate FP per player
      const agg: Record<number, { totalFp: number; gp: number }> = {};
      for (const l of logs ?? []) {
        if (!agg[l.player_id]) agg[l.player_id] = { totalFp: 0, gp: 0 };
        agg[l.player_id].totalFp += Number(l.fp);
        agg[l.player_id].gp += 1;
      }

      const playerIds = Object.keys(agg).map(Number);
      if (playerIds.length === 0) return { players: [], gw };

      // Fetch player info
      const batchSize = 200;
      const players: { id: number; name: string; team: string; photo: string | null; fc_bc: string }[] = [];
      for (let i = 0; i < playerIds.length; i += batchSize) {
        const batch = playerIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from("players")
          .select("id, name, team, photo, fc_bc")
          .in("id", batch);
        if (error) throw error;
        if (data) players.push(...data);
      }

      const candidates: TOTWPlayer[] = players.map((p) => {
        const a = agg[p.id];
        return {
          id: p.id,
          name: p.name,
          team: p.team,
          photo: p.photo,
          fc_bc: p.fc_bc,
          fp_avg: Math.round((a.totalFp / a.gp) * 10) / 10,
          gp: a.gp,
        };
      });

      const top5 = pickTop5WithPositionConstraint(candidates);

      return { players: top5, gw };
    },
    staleTime: 300_000,
  });
}
