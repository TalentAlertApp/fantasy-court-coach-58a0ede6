import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TrendRow {
  id: number;
  name: string;
  team: string;
  photo: string | null;
  seasonAvg: number;
  avg7d: number;
  gp7d: number;
  delta: number;
}

export function usePlayingTimeTrends() {
  return useQuery({
    queryKey: ["playing-time-trends"],
    queryFn: async () => {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const cutoff = sevenDaysAgo.toISOString().slice(0, 10);

      // Get recent game logs
      const { data: logs, error: logsErr } = await supabase
        .from("player_game_logs")
        .select("player_id, mp, game_date")
        .gte("game_date", cutoff)
        .gt("mp", 0);

      if (logsErr) throw logsErr;

      // Aggregate per player
      const agg: Record<number, { totalMp: number; gp: number }> = {};
      for (const l of logs ?? []) {
        if (!agg[l.player_id]) agg[l.player_id] = { totalMp: 0, gp: 0 };
        agg[l.player_id].totalMp += Number(l.mp);
        agg[l.player_id].gp += 1;
      }

      const playerIds = Object.keys(agg).map(Number);
      if (playerIds.length === 0) return { increased: [], decreased: [], updatedAt: new Date().toISOString() };

      // Fetch player info in batches
      const batchSize = 200;
      const players: { id: number; name: string; team: string; photo: string | null; mpg: number }[] = [];
      for (let i = 0; i < playerIds.length; i += batchSize) {
        const batch = playerIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from("players")
          .select("id, name, team, photo, mpg")
          .in("id", batch);
        if (error) throw error;
        if (data) players.push(...data.map(p => ({ ...p, mpg: Number(p.mpg) })));
      }

      const increased: TrendRow[] = [];
      const decreased: TrendRow[] = [];

      for (const p of players) {
        const a = agg[p.id];
        if (!a || a.gp < 1) continue;
        const avg7d = a.totalMp / a.gp;
        const delta = avg7d - p.mpg;
        const row: TrendRow = {
          id: p.id,
          name: p.name,
          team: p.team,
          photo: p.photo,
          seasonAvg: p.mpg,
          avg7d: Math.round(avg7d * 10) / 10,
          gp7d: a.gp,
          delta: Math.round(delta * 10) / 10,
        };
        if (delta > 0) increased.push(row);
        else if (delta < 0) decreased.push(row);
      }

      increased.sort((a, b) => b.delta - a.delta);
      decreased.sort((a, b) => a.delta - b.delta);

      return { increased, decreased, updatedAt: new Date().toISOString() };
    },
    staleTime: 300_000,
  });
}
