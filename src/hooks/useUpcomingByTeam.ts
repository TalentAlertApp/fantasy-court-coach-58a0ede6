import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UpcomingGame {
  date: string;    // YYYY-MM-DD
  opponent: string; // tricode
}

export type UpcomingByTeam = Record<string, UpcomingGame[]>;

export function useUpcomingByTeam() {
  return useQuery({
    queryKey: ["upcoming-by-team"],
    queryFn: async () => {
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      const endStr = end.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("schedule_games")
        .select("home_team, away_team, tipoff_utc, status")
        .gte("tipoff_utc", todayStr)
        .lte("tipoff_utc", endStr + "T23:59:59Z")
        .order("tipoff_utc", { ascending: true });

      if (error) throw error;

      const map: UpcomingByTeam = {};
      for (const g of data ?? []) {
        if (!g.tipoff_utc) continue;
        const date = g.tipoff_utc.slice(0, 10);
        const home = g.home_team;
        const away = g.away_team;

        if (!map[home]) map[home] = [];
        if (!map[away]) map[away] = [];
        map[home].push({ date, opponent: away });
        map[away].push({ date, opponent: home });
      }
      return map;
    },
    staleTime: 600_000,
  });
}

/** Get upcoming games for a specific team, starting from today, max 7 entries */
export function getTeamUpcoming(map: UpcomingByTeam | undefined, teamTricode: string): (UpcomingGame | null)[] {
  if (!map) return Array(7).fill(null);

  const today = new Date();
  const days: (UpcomingGame | null)[] = [];

  const teamGames = map[teamTricode] ?? [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const game = teamGames.find((g) => g.date === ds);
    days.push(game ?? null);
  }

  return days;
}
