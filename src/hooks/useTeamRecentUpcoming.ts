import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeagueId } from "@/hooks/useLeagueId";

export interface TeamGameSlot {
  gameId: string;
  opponent: string;
  isHome: boolean;
  tipoffUtc: string;
  played: boolean;
  won?: boolean;
  myPts?: number | null;
  oppPts?: number | null;
  status?: string | null;
  homeTeam: string;
  awayTeam: string;
  gameRecapUrl?: string | null;
  youtubeRecapId?: string | null;
}

export interface TeamRecentUpcoming {
  past: TeamGameSlot[];   // up to 2, oldest → newest
  next: TeamGameSlot[];   // up to 2, soonest → later
}

/**
 * Returns a team's last 2 played games and next 2 scheduled games relative
 * to `referenceIso` (a UTC ISO timestamp — typically the selected gameday's
 * tipoff anchor or `new Date().toISOString()`).
 */
export function useTeamRecentUpcoming(team: string | null, referenceIso: string | null) {
  const { data: leagueId } = useLeagueId();
  return useQuery<TeamRecentUpcoming>({
    queryKey: ["team-recent-upcoming", leagueId, team, referenceIso],
    enabled: !!leagueId && !!team && !!referenceIso,
    staleTime: 300_000,
    queryFn: async () => {
      const ref = referenceIso!;
      const t = team!;

      const baseSelect =
        "game_id, home_team, away_team, home_pts, away_pts, status, tipoff_utc, game_recap_url, youtube_recap_id";

      const [pastRes, nextRes] = await Promise.all([
        supabase
          .from("schedule_games")
          .select(baseSelect)
          .eq("league_id", leagueId!)
          .or(`home_team.eq.${t},away_team.eq.${t}`)
          .lte("tipoff_utc", ref)
          .ilike("status", "%FINAL%")
          .order("tipoff_utc", { ascending: false })
          .limit(2),
        supabase
          .from("schedule_games")
          .select(baseSelect)
          .eq("league_id", leagueId!)
          .or(`home_team.eq.${t},away_team.eq.${t}`)
          .gt("tipoff_utc", ref)
          .order("tipoff_utc", { ascending: true })
          .limit(2),
      ]);
      if (pastRes.error) throw pastRes.error;
      if (nextRes.error) throw nextRes.error;

      const toSlot = (g: any): TeamGameSlot => {
        const isHome = g.home_team === t;
        const myPts = isHome ? g.home_pts : g.away_pts;
        const oppPts = isHome ? g.away_pts : g.home_pts;
        const played = /FINAL/i.test(String(g.status ?? ""));
        return {
          gameId: g.game_id,
          opponent: isHome ? g.away_team : g.home_team,
          isHome,
          tipoffUtc: g.tipoff_utc,
          played,
          won: played && myPts != null && oppPts != null ? myPts > oppPts : undefined,
          myPts,
          oppPts,
          status: g.status,
          homeTeam: g.home_team,
          awayTeam: g.away_team,
          gameRecapUrl: g.game_recap_url ?? null,
          youtubeRecapId: g.youtube_recap_id ?? null,
        };
      };

      return {
        past: (pastRes.data ?? []).map(toSlot).reverse(),
        next: (nextRes.data ?? []).map(toSlot),
      };
    },
  });
}