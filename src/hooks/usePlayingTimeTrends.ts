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

      // Get ALL game logs to compute real season averages
      const { data: allLogs, error: allErr } = await supabase
        .from("player_game_logs")
        .select("player_id, mp, game_date")
        .gt("mp", 0);

      if (allErr) throw allErr;

      // Aggregate season totals and last-7-day totals per player
      const seasonAgg: Record<number, { totalMp: number; gp: number }> = {};
      const recentAgg: Record<number, { totalMp: number; gp: number }> = {};

      for (const l of allLogs ?? []) {
        const pid = l.player_id;
        const mp = Number(l.mp);

        if (!seasonAgg[pid]) seasonAgg[pid] = { totalMp: 0, gp: 0 };
        seasonAgg[pid].totalMp += mp;
        seasonAgg[pid].gp += 1;

        if (l.game_date && l.game_date >= cutoff) {
          if (!recentAgg[pid]) recentAgg[pid] = { totalMp: 0, gp: 0 };
          recentAgg[pid].totalMp += mp;
          recentAgg[pid].gp += 1;
        }
      }

      const playerIds = Object.keys(recentAgg).map(Number);
      if (playerIds.length === 0) return { increased: [], decreased: [], updatedAt: new Date().toISOString() };

      // Fetch player info in batches
      const batchSize = 200;
      const players: { id: number; name: string; team: string; photo: string | null }[] = [];
      for (let i = 0; i < playerIds.length; i += batchSize) {
        const batch = playerIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from("players")
          .select("id, name, team, photo")
          .in("id", batch);
        if (error) throw error;
        if (data) players.push(...data);
      }

      const increased: TrendRow[] = [];
      const decreased: TrendRow[] = [];

      for (const p of players) {
        const recent = recentAgg[p.id];
        const season = seasonAgg[p.id];
        if (!recent || recent.gp < 1 || !season || season.gp < 2) continue;

        const avg7d = recent.totalMp / recent.gp;
        const seasonAvg = season.totalMp / season.gp;
        const delta = avg7d - seasonAvg;

        if (Math.abs(delta) < 0.5) continue;

        const row: TrendRow = {
          id: p.id,
          name: p.name,
          team: p.team,
          photo: p.photo,
          seasonAvg: Math.round(seasonAvg * 10) / 10,
          avg7d: Math.round(avg7d * 10) / 10,
          gp7d: recent.gp,
          delta: Math.round(delta * 10) / 10,
        };
        if (delta > 0) increased.push(row);
        else decreased.push(row);
      }

      increased.sort((a, b) => b.delta - a.delta);
      decreased.sort((a, b) => a.delta - b.delta);

      return { increased, decreased, updatedAt: new Date().toISOString() };
    },
    staleTime: 300_000,
  });
}
