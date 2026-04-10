import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NBA_TEAMS, getTeamLogo } from "@/lib/nba-teams";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import TeamModal from "@/components/TeamModal";

interface NbaTeamSummary {
  tricode: string;
  name: string;
  logo: string;
  primaryColor: string;
  wins: number;
  losses: number;
  activePlayers: number;
  gamesRemaining: number;
}

export default function TeamsPage() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  const { data: scheduleData, isLoading: schedLoading } = useQuery({
    queryKey: ["nba-teams-schedule-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("home_team, away_team, home_pts, away_pts, status");
      if (error) throw error;
      return data;
    },
    staleTime: 120_000,
  });

  const { data: playerCounts, isLoading: playersLoading } = useQuery({
    queryKey: ["nba-teams-active-players"],
    queryFn: async () => {
      // Count players who played at least 1 minute in any game
      const { data, error } = await supabase
        .from("player_game_logs")
        .select("player_id, mp")
        .gt("mp", 0);
      if (error) throw error;
      // Get player team mapping
      const { data: players, error: pErr } = await supabase
        .from("players")
        .select("id, team");
      if (pErr) throw pErr;
      const teamMap = new Map<number, string>();
      for (const p of players ?? []) teamMap.set(p.id, p.team);
      const activeByTeam = new Map<string, Set<number>>();
      for (const log of data ?? []) {
        const team = teamMap.get(log.player_id);
        if (!team) continue;
        if (!activeByTeam.has(team)) activeByTeam.set(team, new Set());
        activeByTeam.get(team)!.add(log.player_id);
      }
      const counts: Record<string, number> = {};
      for (const [team, ids] of activeByTeam) counts[team] = ids.size;
      return counts;
    },
    staleTime: 120_000,
  });

  const teams = useMemo<NbaTeamSummary[]>(() => {
    const records: Record<string, { w: number; l: number; remaining: number }> = {};
    for (const g of scheduleData ?? []) {
      const isFinal = g.status?.toUpperCase().includes("FINAL");
      for (const t of [g.home_team, g.away_team]) {
        if (!records[t]) records[t] = { w: 0, l: 0, remaining: 0 };
        if (isFinal) {
          const isHome = t === g.home_team;
          const won = isHome ? g.home_pts > g.away_pts : g.away_pts > g.home_pts;
          if (won) records[t].w++; else records[t].l++;
        } else {
          records[t].remaining++;
        }
      }
    }

    return NBA_TEAMS.map((t) => ({
      tricode: t.tricode,
      name: t.name,
      logo: t.logo,
      primaryColor: t.primaryColor,
      wins: records[t.tricode]?.w ?? 0,
      losses: records[t.tricode]?.l ?? 0,
      activePlayers: playerCounts?.[t.tricode] ?? 0,
      gamesRemaining: records[t.tricode]?.remaining ?? 0,
    })).sort((a, b) => {
      const wpA = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
      const wpB = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
      return wpB - wpA;
    });
  }, [scheduleData, playerCounts]);

  const isLoading = schedLoading || playersLoading;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-heading font-bold uppercase tracking-wider">NBA Teams</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 30 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {teams.map((t) => {
            const wp = t.wins + t.losses > 0 ? ((t.wins / (t.wins + t.losses)) * 100).toFixed(1) : "0.0";
            return (
              <Card
                key={t.tricode}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 rounded-sm border-2 group"
                style={{ borderColor: `${t.primaryColor}40` }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = t.primaryColor; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${t.primaryColor}40`; }}
                onClick={() => setSelectedTeam(t.tricode)}
              >
                <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                  <img
                    src={t.logo}
                    alt={t.name}
                    className="w-12 h-12 transition-transform duration-200 group-hover:scale-110"
                  />
                  <div>
                    <p className="font-heading font-bold text-sm uppercase">{t.tricode}</p>
                    <p className="text-[10px] text-muted-foreground">{t.name}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-bold">{t.wins}-{t.losses}</span>
                    <span className="text-[10px] text-muted-foreground">({wp}%)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-[9px] rounded-sm">
                      {t.activePlayers} players
                    </Badge>
                    <Badge variant="secondary" className="text-[9px] rounded-sm">
                      {t.gamesRemaining} remaining
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TeamModal
        tricode={selectedTeam}
        open={selectedTeam !== null}
        onOpenChange={(open) => !open && setSelectedTeam(null)}
      />
    </div>
  );
}
