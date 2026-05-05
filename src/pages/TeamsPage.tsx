import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NBA_TEAMS, getTeamLogo } from "@/lib/nba-teams";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import TeamModal from "@/components/TeamModal";
import { useNBAStandings } from "@/hooks/useNBAStandings";
import StandingsPanel from "@/components/standings/StandingsPanel";
import StandingsFilters, { type StandingsView } from "@/components/standings/StandingsFilters";
import { cn } from "@/lib/utils";
import nbaLogo from "@/assets/nba-logo.svg";
import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import PlayerModal from "@/components/PlayerModal";

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

type Tab = "teams" | "standings";

export default function TeamsPage() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("teams");
  const [standingsView, setStandingsView] = useState<StandingsView>("division");

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
      const { data, error } = await supabase
        .from("player_game_logs")
        .select("player_id, mp")
        .gt("mp", 0);
      if (error) throw error;
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

  const standings = useNBAStandings(scheduleData ?? undefined);

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

  const TABS: { value: Tab; label: string }[] = [
    { value: "teams", label: "Teams" },
    { value: "standings", label: "Standings" },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 space-y-4">
      <div className="flex items-center gap-4 shrink-0">
        <h1 className="text-xl font-heading font-bold uppercase tracking-wider">NBA Teams</h1>
        <div className="inline-flex bg-muted rounded-xl p-0.5 gap-0.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                "px-3 py-1 text-xs font-heading uppercase rounded-xl transition-colors",
                tab === t.value
                  ? "bg-background text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "standings" && (
          <div className="ml-2">
            <StandingsFilters view={standingsView} onChange={setStandingsView} />
          </div>
        )}
      </div>

      {tab === "teams" && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {Array.from({ length: 30 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {teams.map((t) => {
                const wp = t.wins + t.losses > 0 ? ((t.wins / (t.wins + t.losses)) * 100).toFixed(1) : "0.0";
                return (
                  <Card
                    key={t.tricode}
                    className="cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-xl border group overflow-hidden relative"
                    style={{ borderColor: `${t.primaryColor}30` }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = t.primaryColor; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${t.primaryColor}30`; }}
                    onClick={() => setSelectedTeam(t.tricode)}
                  >
                    {/* Watermark logo */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                      <img src={t.logo} alt="" className="w-24 h-24 opacity-10 group-hover:scale-125 group-hover:opacity-25 transition-all duration-500" />
                    </div>
                    {/* NBA league logo — small color watermark, top-right */}
                    <img
                      src={nbaLogo}
                      alt=""
                      aria-hidden
                      className="pointer-events-none absolute top-1.5 right-1.5 h-5 w-auto opacity-80 select-none z-[1]"
                    />

                    <CardContent className="p-5 flex flex-col items-center justify-center gap-2 text-center relative z-10">
                      <p className="font-heading font-black text-lg uppercase tracking-wider">{t.tricode}</p>
                      <p className="text-[10px] font-bold" style={{ color: t.primaryColor }}>{t.name}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm font-bold">{t.wins}-{t.losses}</span>
                        <span className="text-[10px] text-muted-foreground">({wp}%)</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] rounded-xl">{t.activePlayers} players</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "standings" && (
        isLoading ? (
          <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-3">
            <div className="flex-1 min-h-0 overflow-auto pr-1">
              <StandingsPanel standings={standings} onTeamClick={setSelectedTeam} view={standingsView} />
            </div>
            <div className="mt-auto">
              <StandingsBallersIQ standings={standings} onTeamClick={setSelectedTeam} />
            </div>
          </div>
        )
      )}

      <TeamModal
        tricode={selectedTeam}
        open={selectedTeam !== null}
        onOpenChange={(open) => !open && setSelectedTeam(null)}
      />
    </div>
  );
}

function StandingsBallersIQ({ standings, onTeamClick }: { standings: any[]; onTeamClick: (tri: string) => void }) {
  const { data: rosterData } = useRosterQuery();
  const { data: playersData } = usePlayersQuery({ limit: 1000 });
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);

  const userTeams = new Set<string>();
  const ids: number[] = [
    ...(rosterData?.roster?.starters ?? []),
    ...(rosterData?.roster?.bench ?? []),
  ].filter((x) => x > 0);
  for (const id of ids) {
    const p = playersData?.items.find((x: any) => x.core.id === id);
    if (p?.core.team) userTeams.add(p.core.team);
  }

  const sorted = [...standings].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const outstanding = sorted.slice(0, 3);
  const watchList = sorted.filter((t) => !userTeams.has(t.tricode)).slice(0, 3);

  // Hidden gems: top players from bottom-half teams by FP
  const median = sorted[Math.floor(sorted.length / 2)]?.pct ?? 0;
  const lowerTeams = new Set(sorted.filter((t) => (t.pct ?? 0) < median).map((t) => t.tricode));
  const gems = (playersData?.items ?? [])
    .filter((p: any) => lowerTeams.has(p.core.team))
    .sort((a: any, b: any) => (b.season?.fp ?? 0) - (a.season?.fp ?? 0))
    .slice(0, 3);

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="relative rounded-xl border border-amber-400/25 bg-card/60 p-3 overflow-hidden">
      <BallersIQBrand variant="emblem" forceTheme="light" transparent className="pointer-events-none absolute -top-3 -right-3 !h-20 !w-20 object-contain opacity-[0.14] rotate-12 select-none" />
      <header className="flex items-center gap-2 mb-1.5 relative z-[1]">
        <BallersIQBrand variant="emblem" forceTheme="light" transparent size="sm" />
        <span className="text-[9px] font-heading font-bold uppercase tracking-[0.16em] text-amber-400/90">{title}</span>
      </header>
      <div className="relative z-[1] space-y-1">{children}</div>
    </div>
  );

  return (
    <section className="shrink-0 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/[0.04] via-card to-card p-3 shadow-[0_4px_24px_-12px_hsl(45_90%_55%/0.3)]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Card title="Outstanding teams">
          {outstanding.map((t) => {
            const logo = getTeamLogo(t.tricode);
            return (
              <button key={t.tricode} onClick={() => onTeamClick(t.tricode)} className="group w-full flex items-center gap-2 text-left text-xs hover:text-amber-400 transition-colors">
                {logo && (
                  <img src={logo} alt="" className="h-6 w-6 object-contain shrink-0 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-3" />
                )}
                <span className="font-heading font-bold uppercase">{t.tricode}</span>
                <span className="ml-auto text-muted-foreground">{t.w}-{t.l} · {((t.pct ?? 0) * 100).toFixed(0)}%</span>
              </button>
            );
          })}
        </Card>
        <Card title="Watch list (no roster players)">
          {watchList.length ? watchList.map((t) => {
            const logo = getTeamLogo(t.tricode);
            return (
              <button key={t.tricode} onClick={() => onTeamClick(t.tricode)} className="group w-full flex items-center gap-2 text-left text-xs hover:text-amber-400 transition-colors">
                {logo && (
                  <img src={logo} alt="" className="h-6 w-6 object-contain shrink-0 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-3" />
                )}
                <span className="font-heading font-bold uppercase">{t.tricode}</span>
                <span className="ml-auto text-muted-foreground">{t.w}-{t.l}</span>
              </button>
            );
          }) : <p className="text-[11px] text-muted-foreground">All top teams represented.</p>}
        </Card>
        <Card title="Hidden gems (lower-ranked teams)">
          {gems.length ? gems.map((p: any) => {
            const logo = getTeamLogo(p.core.team);
            return (
              <button
                key={p.core.id}
                onClick={() => setOpenPlayerId(p.core.id)}
                className="group w-full flex items-center gap-2 text-left text-xs hover:text-amber-400 transition-colors"
              >
                <div className="relative h-7 w-7 shrink-0">
                  {logo && (
                    <img src={logo} alt="" className="absolute -right-1 -bottom-1 h-4 w-4 object-contain opacity-90 z-[1]" />
                  )}
                  {p.core.photo ? (
                    <img
                      src={p.core.photo}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover bg-muted ring-1 ring-amber-400/30 transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-muted ring-1 ring-amber-400/30" />
                  )}
                </div>
                <span className="truncate font-medium">{p.core.name}</span>
                <span className="ml-auto text-muted-foreground shrink-0">{p.core.team} · {(p.season?.fp ?? 0).toFixed(1)} FP</span>
              </button>
            );
          }) : <p className="text-[11px] text-muted-foreground">Not enough data.</p>}
        </Card>
      </div>
      <PlayerModal
        playerId={openPlayerId}
        open={openPlayerId !== null}
        onOpenChange={(o) => !o && setOpenPlayerId(null)}
      />
    </section>
  );
}
