import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentGameday, DEADLINES, type Deadline } from "@/lib/deadlines";
import { useLeagueId } from "@/hooks/useLeagueId";
import { useLeagueDeadlines, getCurrentGamedayFrom } from "@/hooks/useLeagueDeadlines";

export interface UpcomingGame {
  date: string;    // YYYY-MM-DD
  opponent: string; // tricode
  isHome: boolean;
  tipoffUtc: string; // ISO
  gameId?: string;
  gw?: number;
  day?: number;
  homeTeam?: string;
  awayTeam?: string;
  homePts?: number | null;
  awayPts?: number | null;
  status?: string | null;
  boxscoreUrl?: string | null;
  chartsUrl?: string | null;
  pbpUrl?: string | null;
  recapUrl?: string | null;
  nbaGameUrl?: string | null;
  youtubeRecapId?: string | null;
}

export type UpcomingByTeam = Record<string, UpcomingGame[]>;

export function useUpcomingByTeam() {
  const { data: leagueId } = useLeagueId();
  const { deadlines } = useLeagueDeadlines();
  return useQuery({
    queryKey: ["upcoming-by-team", leagueId, deadlines.length],
    enabled: !!leagueId,
    queryFn: async () => {
      // Anchor "today" on the current gameday deadline rather than wall-clock.
      // The schedule may end before real-world now (off-season / dataset cutoff),
      // so we fall back to the current gameday's deadline date so upcoming
      // opponents still surface for the active GW.
      const realNow = new Date();
      const gd = (deadlines.length > 0 ? getCurrentGamedayFrom(deadlines) : null) ?? getCurrentGameday();
      const gdDate = new Date(gd.deadline_utc);
      // Use the EARLIER of (real now, current gameday deadline) so we always
      // include the next gameday's games — even if dataset hasn't been bumped.
      const anchor = gdDate < realNow ? gdDate : realNow;
      // Look back 1 day to absorb timezone edges, forward 8 to cover the week.
      const start = new Date(anchor);
      // Look back a full week so earlier days of the current GW (already played)
      // are included alongside upcoming slots.
      start.setDate(start.getDate() - 7);
      const startStr = start.toISOString().slice(0, 10);
      const end = new Date(anchor);
      end.setDate(end.getDate() + 7);
      const endStr = end.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("schedule_games")
        .select("game_id, gw, day, home_team, away_team, home_pts, away_pts, tipoff_utc, status, game_boxscore_url, game_charts_url, game_playbyplay_url, game_recap_url, nba_game_url, youtube_recap_id")
        .eq("league_id", leagueId!)
        .gte("tipoff_utc", startStr)
        .lte("tipoff_utc", endStr + "T23:59:59Z")
        .order("tipoff_utc", { ascending: true });

      if (error) throw error;

      const map: UpcomingByTeam = {};
      for (const g of data ?? []) {
        if (!g.tipoff_utc) continue;
        // Use Europe/Lisbon local date to match how gamedays are bucketed in the UI.
        const lisbonDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Lisbon",
          year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date(g.tipoff_utc));
        const date = lisbonDate; // YYYY-MM-DD
        const home = g.home_team;
        const away = g.away_team;
        const common = {
          gameId: (g as any).game_id,
          gw: (g as any).gw,
          day: (g as any).day,
          homeTeam: home,
          awayTeam: away,
          homePts: (g as any).home_pts,
          awayPts: (g as any).away_pts,
          status: g.status,
          boxscoreUrl: (g as any).game_boxscore_url,
          chartsUrl: (g as any).game_charts_url,
          pbpUrl: (g as any).game_playbyplay_url,
          recapUrl: (g as any).game_recap_url,
          nbaGameUrl: (g as any).nba_game_url,
          youtubeRecapId: (g as any).youtube_recap_id,
        };
        if (!map[home]) map[home] = [];
        if (!map[away]) map[away] = [];
        map[home].push({ date, opponent: away, isHome: true, tipoffUtc: g.tipoff_utc, ...common });
        map[away].push({ date, opponent: home, isHome: false, tipoffUtc: g.tipoff_utc, ...common });
      }
      return map;
    },
    staleTime: 600_000,
  });
}

/** Get upcoming games for a specific team, starting from today, max 7 entries */
export function getTeamUpcoming(
  map: UpcomingByTeam | undefined,
  teamTricode: string,
  deadlines?: Deadline[],
): (UpcomingGame | null)[] {
  if (!map) return Array(7).fill(null);

  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  // Anchor on the current gameday rather than wall-clock so we keep showing
  // upcoming opponents during off-season / dataset gaps.
  const realNow = new Date();
  const gd = (deadlines && deadlines.length > 0 ? getCurrentGamedayFrom(deadlines) : null) ?? getCurrentGameday();
  const gdDate = new Date(gd.deadline_utc);
  const today = gdDate < realNow ? gdDate : realNow;
  const days: (UpcomingGame | null)[] = [];

  const teamGames = map[teamTricode] ?? [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const ds = fmt.format(d);
    const game = teamGames.find((g) => g.date === ds);
    days.push(game ?? null);
  }

  return days;
}

/** Format an ISO tipoff into a friendly Europe/Lisbon "Sun 12 Apr · 21:30" label. */
export function formatTipoffLabel(iso: string): string {
  try {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Lisbon",
      weekday: "short", day: "numeric", month: "short",
    }).format(d);
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Lisbon",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(d);
    return `${date} · ${time}`;
  } catch { return iso; }
}

/**
 * Returns one slot per day of the given gameweek (1..N).
 * Each slot is the upcoming game that team plays on that gameday's Lisbon date,
 * or null if the team is not playing.
 */
export function getTeamGameweekSlots(
  map: UpcomingByTeam | undefined,
  teamTricode: string,
  gw: number,
  deadlines: Deadline[] = DEADLINES,
): (UpcomingGame | null)[] {
  const days = deadlines.filter((d) => d.gw === gw);
  if (!map) return days.map(() => null);

  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric", month: "2-digit", day: "2-digit",
  });

  const teamGames = map[teamTricode] ?? [];
  return days.map((dl) => {
    // Prefer authoritative gw/day from schedule_games (handles after-midnight
    // tipoffs that fall on the next Lisbon date but belong to the previous GW).
    const byGwDay = teamGames.find((g) => g.gw === dl.gw && g.day === dl.day);
    if (byGwDay) return byGwDay;
    // Fallback for legacy rows without gw/day populated.
    const ds = fmt.format(new Date(dl.deadline_utc));
    return teamGames.find((g) => g.date === ds && g.gw == null) ?? null;
  });
}
