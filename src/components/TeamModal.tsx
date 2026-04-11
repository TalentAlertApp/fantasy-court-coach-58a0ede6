import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Table2, BarChart3, Mic, ExternalLink, Tv2 } from "lucide-react";
import { getTeamByTricode, getTeamLogo } from "@/lib/nba-teams";
import PlayerModal from "@/components/PlayerModal";

interface TeamModalProps {
  tricode: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RosterSort = "mpg" | "ppg" | "fpg" | "salary";

export default function TeamModal({ tricode, open, onOpenChange }: TeamModalProps) {
  const team = tricode ? getTeamByTricode(tricode) : null;
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [rosterSort, setRosterSort] = useState<RosterSort>("fpg");
  const [expandedRecap, setExpandedRecap] = useState<string | null>(null);

  const { data: gamesData, isLoading: gamesLoading } = useQuery({
    queryKey: ["team-games", tricode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("*")
        .or(`home_team.eq.${tricode},away_team.eq.${tricode}`)
        .order("tipoff_utc", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!tricode,
    staleTime: 60_000,
  });

  const { data: rosterData, isLoading: rosterLoading } = useQuery({
    queryKey: ["team-roster-agg", tricode],
    queryFn: async () => {
      const { data: teamPlayers, error: pErr } = await supabase
        .from("players")
        .select("id, name, photo, fc_bc, salary")
        .eq("team", tricode!);
      if (pErr) throw pErr;

      const playerIds = (teamPlayers ?? []).map(p => p.id);
      if (playerIds.length === 0) return [];

      const { data: logs, error: lErr } = await supabase
        .from("player_game_logs")
        .select("player_id, mp, pts, fp")
        .in("player_id", playerIds)
        .gt("mp", 0);
      if (lErr) throw lErr;

      const agg = new Map<number, { gp: number; total_mp: number; total_pts: number; total_fp: number }>();
      for (const log of (logs ?? [])) {
        let s = agg.get(log.player_id);
        if (!s) { s = { gp: 0, total_mp: 0, total_pts: 0, total_fp: 0 }; agg.set(log.player_id, s); }
        s.gp++;
        s.total_mp += log.mp;
        s.total_pts += log.pts;
        s.total_fp += log.fp;
      }

      return (teamPlayers ?? []).map(p => {
        const s = agg.get(p.id);
        return {
          ...p,
          gp: s?.gp ?? 0,
          mpg: s ? s.total_mp / s.gp : 0,
          ppg: s ? s.total_pts / s.gp : 0,
          fpg: s ? s.total_fp / s.gp : 0,
        };
      }).filter(p => p.gp > 0);
    },
    enabled: open && !!tricode,
    staleTime: 60_000,
  });

  const sortedRoster = useMemo(() => {
    if (!rosterData) return [];
    return [...rosterData].sort((a, b) => {
      if (rosterSort === "salary") return b.salary - a.salary;
      return b[rosterSort] - a[rosterSort];
    });
  }, [rosterData, rosterSort]);

  const played = useMemo(() => (gamesData ?? []).filter(g => g.status?.toUpperCase().includes("FINAL")), [gamesData]);
  const upcoming = useMemo(() => (gamesData ?? []).filter(g => !g.status?.toUpperCase().includes("FINAL")).reverse(), [gamesData]);

  if (!open || !tricode) return null;

  const sortHeader = (label: string, key: RosterSort) => (
    <button
      onClick={() => setRosterSort(key)}
      className={`text-[10px] uppercase tracking-wider ${rosterSort === key ? "font-bold text-foreground" : "text-muted-foreground"} hover:text-foreground transition-colors`}
    >
      {label}
    </button>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg rounded-sm max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {team && <img src={team.logo} alt={team.name} className="w-10 h-10" />}
              <DialogTitle className="font-heading uppercase">{team?.name ?? tricode}</DialogTitle>
            </div>
          </DialogHeader>

          <Tabs defaultValue="played" className="flex-1 min-h-0 flex flex-col">
            <TabsList className="rounded-sm shrink-0">
              <TabsTrigger value="played" className="font-heading text-xs uppercase rounded-sm">Played ({played.length})</TabsTrigger>
              <TabsTrigger value="upcoming" className="font-heading text-xs uppercase rounded-sm">Upcoming ({upcoming.length})</TabsTrigger>
              <TabsTrigger value="roster" className="font-heading text-xs uppercase rounded-sm">Roster ({sortedRoster.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="played" className="flex-1 min-h-0">
              {gamesLoading ? <Skeleton className="h-40" /> : (
                <ScrollArea className="h-[50vh]">
                  <div className="space-y-1">
                    {played.map((g) => {
                      const isHome = g.home_team === tricode;
                      const opp = isHome ? g.away_team : g.home_team;
                      const oppLogo = getTeamLogo(opp);
                      const won = isHome ? g.home_pts > g.away_pts : g.away_pts > g.home_pts;
                      return (
                        <div key={g.game_id}>
                          <div
                            className="flex items-center gap-2 px-3 py-2 border-b border-border/40 text-sm cursor-pointer hover:bg-accent/30 transition-colors"
                            onClick={() => setSelectedGame(g)}
                          >
                            <Badge variant={won ? "default" : "destructive"} className="rounded-sm text-[9px] w-5 justify-center">{won ? "W" : "L"}</Badge>
                            {oppLogo && <img src={oppLogo} alt="" className="w-4 h-4" />}
                            <span className="font-heading text-xs uppercase">{isHome ? "vs" : "@"} {opp}</span>
                            <span className="ml-auto font-mono text-xs font-bold">
                              {isHome ? g.home_pts : g.away_pts}-{isHome ? g.away_pts : g.home_pts}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">GW{g.gw}.{g.day}</span>
                            <div className="flex items-center gap-0.5">
                              {g.game_boxscore_url && (
                                <a href={g.game_boxscore_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-0.5" onClick={(e) => e.stopPropagation()} title="Box Score">
                                  <Table2 className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {g.game_charts_url && (
                                <a href={g.game_charts_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-0.5" onClick={(e) => e.stopPropagation()} title="Charts">
                                  <BarChart3 className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {g.game_playbyplay_url && (
                                <a href={g.game_playbyplay_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-0.5" onClick={(e) => e.stopPropagation()} title="Play-by-Play">
                                  <Mic className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {g.nba_game_url && (
                                <a href={g.nba_game_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-0.5" onClick={(e) => e.stopPropagation()} title="NBA.com">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                              <button
                                className={`${g.youtube_recap_id ? "text-green-500 hover:text-green-400 cursor-pointer" : "text-muted-foreground/30 cursor-default"} transition-colors p-0.5`}
                                onClick={(e) => { e.stopPropagation(); if (g.youtube_recap_id) setExpandedRecap(expandedRecap === g.game_id ? null : g.game_id); }}
                                title="Video Recap"
                                disabled={!g.youtube_recap_id}
                              >
                                <Tv2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          {expandedRecap === g.game_id && g.youtube_recap_id && (
                            <div className="px-3 py-2 border-b border-border/40 bg-muted/30">
                              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                                <iframe
                                  className="absolute inset-0 w-full h-full rounded-sm"
                                  src={`https://www.youtube.com/embed/${g.youtube_recap_id}`}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="upcoming" className="flex-1 min-h-0">
              {gamesLoading ? <Skeleton className="h-40" /> : (
                <ScrollArea className="h-[50vh]">
                  <div className="space-y-1">
                    {upcoming.map((g) => {
                      const isHome = g.home_team === tricode;
                      const opp = isHome ? g.away_team : g.home_team;
                      const oppLogo = getTeamLogo(opp);
                      const tipoff = g.tipoff_utc ? new Date(g.tipoff_utc).toLocaleDateString("en-GB", { month: "short", day: "numeric" }) : "TBD";
                      return (
                        <div key={g.game_id} className="flex items-center gap-2 px-3 py-2 border-b border-border/40 text-sm">
                          {oppLogo && <img src={oppLogo} alt="" className="w-4 h-4" />}
                          <span className="font-heading text-xs uppercase">{isHome ? "vs" : "@"} {opp}</span>
                          <span className="ml-auto text-xs text-muted-foreground">{tipoff}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">GW{g.gw}.{g.day}</span>
                        </div>
                      );
                    })}
                    {upcoming.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No upcoming games</p>}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="roster" className="flex-1 min-h-0">
              {rosterLoading ? <Skeleton className="h-40" /> : (
                <ScrollArea className="h-[50vh]">
                  {/* Header */}
                  <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border sticky top-0 bg-card z-10">
                    <span className="flex-1 text-[10px] uppercase tracking-wider text-muted-foreground">Player</span>
                    <span className="w-12 text-right">{sortHeader("MPG", "mpg")}</span>
                    <span className="w-12 text-right">{sortHeader("PPG", "ppg")}</span>
                    <span className="w-12 text-right">{sortHeader("FP", "fpg")}</span>
                    <span className="w-10 text-right">{sortHeader("$", "salary")}</span>
                  </div>
                  <div className="space-y-0">
                    {sortedRoster.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-2 border-b border-border/40 text-sm cursor-pointer hover:bg-accent/30 transition-colors"
                        onClick={() => setSelectedPlayerId(p.id)}
                      >
                        <Avatar className="h-6 w-6 shrink-0">
                          {p.photo && <AvatarImage src={p.photo} />}
                          <AvatarFallback className="text-[8px]">{p.name.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <Badge variant={p.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-0.5 py-0 rounded-sm">{p.fc_bc}</Badge>
                        <span className="text-xs font-medium flex-1 truncate">{p.name}</span>
                        <span className="w-12 text-right text-xs font-mono text-muted-foreground">{p.mpg.toFixed(1)}</span>
                        <span className="w-12 text-right text-xs font-mono">{p.ppg.toFixed(1)}</span>
                        <span className="w-12 text-right text-xs font-mono font-bold">{p.fpg.toFixed(1)}</span>
                        <span className="w-10 text-right text-[10px] text-muted-foreground">${p.salary}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <PlayerModal
        playerId={selectedPlayerId}
        open={selectedPlayerId !== null}
        onOpenChange={(o) => { if (!o) setSelectedPlayerId(null); }}
      />

    </>
  );
}
