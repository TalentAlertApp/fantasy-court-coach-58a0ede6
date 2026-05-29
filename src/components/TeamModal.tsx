import { useMemo, useState } from "react";
import { getLeagueLogo } from "@/lib/competitions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Table2, BarChart3, Mic, ExternalLink, Tv2, Swords } from "lucide-react";
import { useLeagueTeams } from "@/hooks/useLeagueTeams";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueId } from "@/hooks/useLeagueId";
import { getEuroLeagueTeamRecord } from "@/lib/euroleague-team-registry";
import { useTeamDifficultyMap } from "@/hooks/useTeamDifficultyMap";
import { difficultyRingColor } from "@/lib/ballers-iq/difficultyColor";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TeamCompareModal from "@/components/TeamCompareModal";
import PlayerModal from "@/components/PlayerModal";
import GameDetailModal, { type GameDetailGame } from "@/components/GameDetailModal";
import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";
import NationalityFlag from "@/components/NationalityFlag";

interface TeamModalProps {
  tricode: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RosterSort = "mpg" | "ppg" | "fpg" | "salary";

export default function TeamModal({ tricode, open, onOpenChange }: TeamModalProps) {
  const { teams: leagueTeams } = useLeagueTeams();
  const { league } = useLeague();
  const { data: leagueId } = useLeagueId();
  const team = tricode ? (leagueTeams.find((t) => t.tricode === tricode) ?? null) : null;
  const euroleagueMeta = league === "euroleague" ? getEuroLeagueTeamRecord(tricode ?? undefined) : undefined;
  const getOppLogo = (tri: string) => leagueTeams.find((t) => t.tricode === tri)?.logo;
  const { data: difficultyMap } = useTeamDifficultyMap();
  const watermarkLogo = getLeagueLogo(league);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [rosterSort, setRosterSort] = useState<RosterSort>("fpg");
  const [selectedGame, setSelectedGame] = useState<GameDetailGame | null>(null);
  const [compareOpp, setCompareOpp] = useState<string | null>(null);
  const [comparePickerOpen, setComparePickerOpen] = useState(false);

  const { data: gamesData, isLoading: gamesLoading } = useQuery({
    queryKey: ["team-games", tricode, leagueId],
    queryFn: async () => {
      let q = supabase
        .from("schedule_games")
        .select("*")
        .or(`home_team.eq.${tricode},away_team.eq.${tricode}`)
        .order("tipoff_utc", { ascending: false });
      if (leagueId) q = q.eq("league_id", leagueId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!tricode && !!leagueId,
    staleTime: 60_000,
  });

  const { data: rosterData, isLoading: rosterLoading } = useQuery({
    queryKey: ["team-roster-agg", tricode, leagueId],
    queryFn: async () => {
      let pq = supabase
        .from("players")
        .select("id, name, photo, fc_bc, salary, nationality, jersey, height")
        .eq("team", tricode!);
      if (leagueId) pq = pq.eq("league_id", leagueId);
      const { data: teamPlayers, error: pErr } = await pq;
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
      });
    },
    enabled: open && !!tricode && !!leagueId,
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
        <DialogContent className="max-w-xl rounded-xl max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
          <img
            src={watermarkLogo}
            alt=""
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 h-44 w-auto opacity-[0.05] select-none z-0"
          />
          {/* Premium Header — full-bleed gradient, oversized rotated logo watermark, KPI pills */}
          <DialogHeader className="relative overflow-hidden border-b border-border/50 px-5 pt-5 pb-4 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent shrink-0">
            {team && (
              <>
                {/* Blurred parallax backdrop */}
                <img
                  src={team.logo}
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute -top-12 -right-12 h-56 w-56 object-contain opacity-[0.18] rotate-12 select-none blur-[1px]"
                />
                {/* Subtle radial accent */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-60"
                  style={{
                    background:
                      "radial-gradient(circle at 100% 0%, hsl(var(--primary) / 0.18) 0%, transparent 60%)",
                  }}
                />
              </>
            )}
            <div className="relative z-10 flex items-center gap-3">
              {team && (
                <div className="shrink-0 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50 p-1.5 shadow-[0_4px_16px_-6px_hsl(var(--primary)/0.4)]">
                  <img src={team.logo} alt={team.name} className="w-12 h-12 object-contain" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <DialogTitle className="font-heading uppercase tracking-wide text-base leading-tight truncate">
                  {team?.name ?? tricode}
                </DialogTitle>
                {league === "euroleague" && (euroleagueMeta || team?.venueName) && (
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                    {[tricode, euroleagueMeta?.city, euroleagueMeta?.country, euroleagueMeta?.venue_name ?? team?.venueName]
                      .filter(Boolean).join(" · ")}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 text-[9px] font-heading uppercase tracking-wider text-muted-foreground">
                    <span className="text-foreground font-bold">{played.length}</span> GP
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 text-[9px] font-heading uppercase tracking-wider text-muted-foreground">
                    <span className="text-foreground font-bold">{sortedRoster.length}</span> roster
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 text-[9px] font-heading uppercase tracking-wider text-muted-foreground">
                    <span className="text-foreground font-bold">{upcoming.length}</span> upcoming
                  </span>
                </div>
              </div>
              {tricode && (
                <Popover open={comparePickerOpen} onOpenChange={setComparePickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className="shrink-0 ml-auto inline-flex items-center gap-1 rounded-lg border border-border/60 bg-background/60 backdrop-blur-sm px-2 py-1 text-[10px] font-heading uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-primary/60 transition-colors"
                      title="Compare with another team"
                    >
                      <Swords className="h-3.5 w-3.5" />
                      Compare
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 p-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pb-1">vs…</div>
                    <div
                      className="grid grid-cols-1 gap-0.5 max-h-[60vh] overflow-y-auto pr-1"
                      onWheel={(e) => e.stopPropagation()}
                    >
                      {leagueTeams.filter(t => t.tricode !== tricode).map(t => (
                        <button
                          key={t.tricode}
                          onClick={() => { setCompareOpp(t.tricode); setComparePickerOpen(false); }}
                          className="relative overflow-hidden flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-left"
                        >
                          <span className="text-xs font-heading uppercase">{t.tricode}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{t.name}</span>
                          <img
                            src={t.logo}
                            alt=""
                            aria-hidden
                            className="pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 h-12 w-12 object-contain opacity-[0.22] rotate-12 blur-[0.5px] select-none"
                          />
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </DialogHeader>

          <Tabs defaultValue="played" className="relative z-10 flex-1 min-h-0 flex flex-col px-4 pb-4 pt-3">
            <TabsList className="rounded-lg shrink-0 grid grid-cols-4">
              <TabsTrigger value="played" className="font-heading text-xs uppercase rounded-lg">Played ({played.length})</TabsTrigger>
              <TabsTrigger value="upcoming" className="font-heading text-xs uppercase rounded-lg">Upcoming ({upcoming.length})</TabsTrigger>
              <TabsTrigger value="roster" className="font-heading text-xs uppercase rounded-lg">Roster ({sortedRoster.length})</TabsTrigger>
              <TabsTrigger value="biq" className="rounded-lg flex items-center justify-center px-1" title="Ballers.IQ">
                <BallersIQBrand variant="wordmark" forceTheme="light" transparent className="dark:hidden !h-5 w-auto" />
                <BallersIQBrand variant="wordmark" forceTheme="dark" transparent className="hidden dark:block !h-5 w-auto" />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="played" className="flex-1 min-h-0">
              {gamesLoading ? <Skeleton className="h-40" /> : (
                <ScrollArea className="h-[50vh]">
                  <div className="space-y-1">
                    {played.map((g) => {
                      const isHome = g.home_team === tricode;
                      const opp = isHome ? g.away_team : g.home_team;
                      const oppLogo = getOppLogo(opp);
                      const won = isHome ? g.home_pts > g.away_pts : g.away_pts > g.home_pts;
                      const myScore = isHome ? g.home_pts : g.away_pts;
                      const oppScore = isHome ? g.away_pts : g.home_pts;
                      const openDetail = () => setSelectedGame({
                        game_id: g.game_id,
                        home_team: g.home_team,
                        away_team: g.away_team,
                        home_pts: g.home_pts,
                        away_pts: g.away_pts,
                        status: g.status,
                        game_boxscore_url: g.game_boxscore_url,
                        game_charts_url: g.game_charts_url,
                        game_playbyplay_url: g.game_playbyplay_url,
                        game_recap_url: g.game_recap_url,
                        nba_game_url: g.nba_game_url,
                        youtube_recap_id: (g as any).youtube_recap_id ?? null,
                        played: true,
                      });
                      return (
                        <div key={g.game_id}>
                          <div
                            className="flex items-center gap-2 px-3 py-2 border-b border-border/40 text-sm"
                          >
                            <button onClick={openDetail} className="hover:opacity-80 transition-opacity">
                              <Badge
                                variant={won ? "default" : "destructive"}
                                className={`rounded-lg text-[9px] w-5 justify-center cursor-pointer ${won ? "bg-green-500 hover:bg-green-500/90 text-white border-transparent" : ""}`}
                              >
                                {won ? "W" : "L"}
                              </Badge>
                            </button>
                            <span className="font-heading text-xs uppercase inline-flex items-center gap-1">
                              {isHome ? "vs" : "@"} {opp}
                              {oppLogo && <img src={oppLogo} alt="" className="w-4 h-4" />}
                            </span>
                            <button
                              onClick={openDetail}
                              className="ml-auto font-mono text-xs font-bold hover:text-primary transition-colors cursor-pointer"
                              title="Open game details"
                            >
                              {myScore}-{oppScore}
                            </button>
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
                              {g.game_recap_url ? (
                                <a
                                  href={g.game_recap_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-green-500 hover:text-green-400 transition-colors p-0.5"
                                  onClick={(e) => e.stopPropagation()}
                                  title={
                                    league === "euroleague"
                                      ? "Watch Recap on YouTube"
                                      : league === "wnba"
                                      ? "Watch Recap on WNBA.com"
                                      : "Watch Recap on NBA.com"
                                  }
                                >
                                  <Tv2 className="h-3.5 w-3.5" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground/30 p-0.5" title="Recap unavailable">
                                  <Tv2 className="h-3.5 w-3.5" />
                                </span>
                              )}
                            </div>
                          </div>
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
                      const oppLogo = getOppLogo(opp);
                      const diff = difficultyMap?.[opp];
                      const diffColor = difficultyRingColor(diff?.label);
                      const tipoff = g.tipoff_utc ? new Date(g.tipoff_utc).toLocaleDateString("en-GB", { month: "short", day: "numeric" }) : "TBD";
                      const openDetail = () => setSelectedGame({
                        game_id: g.game_id,
                        home_team: g.home_team,
                        away_team: g.away_team,
                        home_pts: g.home_pts ?? 0,
                        away_pts: g.away_pts ?? 0,
                        status: g.status,
                        game_boxscore_url: g.game_boxscore_url,
                        game_charts_url: g.game_charts_url,
                        game_playbyplay_url: g.game_playbyplay_url,
                        game_recap_url: g.game_recap_url,
                        nba_game_url: g.nba_game_url,
                        youtube_recap_id: (g as any).youtube_recap_id ?? null,
                        gw: g.gw, day: g.day,
                        tipoff_utc: g.tipoff_utc,
                        played: false,
                      });
                      return (
                        <button
                          key={g.game_id}
                          type="button"
                          onClick={openDetail}
                          className="w-full flex items-center gap-2 px-3 py-2 border-b border-border/40 text-sm text-left hover:bg-accent/30 transition-colors"
                        >
                          {oppLogo && <img src={oppLogo} alt="" className="w-4 h-4" />}
                          <span className="font-heading text-xs uppercase">{isHome ? "vs" : "@"} {opp}</span>
                          {diff?.label && (
                            <span
                              className="inline-flex items-center justify-center rounded-full border text-[9px] font-heading font-bold w-5 h-5 shrink-0"
                              style={{ color: diffColor, borderColor: diffColor }}
                              title={`Matchup difficulty: ${diff.label}`}
                            >
                              {diff.label.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="ml-auto text-xs text-muted-foreground">{tipoff}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">GW{g.gw}.{g.day}</span>
                        </button>
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
                    <span className="w-6 text-left text-[10px] uppercase tracking-wider text-muted-foreground">#</span>
                    <span className="flex-1 text-[10px] uppercase tracking-wider text-muted-foreground">Player</span>
                    <span className="w-12 text-right text-[10px] uppercase tracking-wider text-muted-foreground" title="Height">H</span>
                    <span className="w-12 text-right" title="Minutes Per Game">{sortHeader("MPG", "mpg")}</span>
                    <span className="w-12 text-right" title="Points Per Game">{sortHeader("PPG", "ppg")}</span>
                    <span className="w-12 text-right" title="Fantasy Points Per Game">{sortHeader("FP", "fpg")}</span>
                    <span className="w-10 text-right" title="Player Salary (in millions)">{sortHeader("$", "salary")}</span>
                  </div>
                  <div className="space-y-0">
                    {sortedRoster.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 px-3 py-2 border-b border-border/40 text-sm cursor-pointer hover:bg-accent/30 transition-colors"
                        onClick={() => setSelectedPlayerId(p.id)}
                      >
                        <span className="w-6 text-left text-[10px] font-mono text-muted-foreground">
                          {(p as any).jersey === null || (p as any).jersey === undefined ? "" : String((p as any).jersey)}
                        </span>
                        <Avatar className="h-6 w-6 shrink-0">
                          {p.photo && <AvatarImage src={p.photo} />}
                          <AvatarFallback className="text-[8px]">{p.name.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <Badge variant={p.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-0.5 py-0 rounded-lg">{p.fc_bc}</Badge>
                        <span className="text-xs font-medium flex-1 truncate inline-flex items-center gap-1.5">
                          <span className="truncate">{p.name}</span>
                          {(p as any).nationality && <NationalityFlag country={(p as any).nationality} size="xs" />}
                        </span>
                        <span className="w-12 text-right text-[11px] font-mono text-muted-foreground">{(p as any).height ?? "—"}</span>
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

            <TabsContent value="biq" className="flex-1 min-h-0">
              <TeamBallersIQ tricode={tricode} played={played} upcoming={upcoming} roster={sortedRoster} onPlayerClick={setSelectedPlayerId} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <PlayerModal
        playerId={selectedPlayerId}
        open={selectedPlayerId !== null}
        onOpenChange={(o) => { if (!o) setSelectedPlayerId(null); }}
      />

      <GameDetailModal
        game={selectedGame}
        open={selectedGame !== null}
        onOpenChange={(o) => !o && setSelectedGame(null)}
      />

      {tricode && compareOpp && (
        <TeamCompareModal
          teamA={tricode}
          teamB={compareOpp}
          open={!!compareOpp}
          onOpenChange={(o) => { if (!o) setCompareOpp(null); }}
        />
      )}

    </>
  );
}

// ──────────────── Ballers.IQ Team Assessment (24h cached) ────────────────
function TeamBallersIQ({ tricode, played, upcoming, roster, onPlayerClick }: {
  tricode: string;
  played: any[];
  upcoming: any[];
  roster: any[];
  onPlayerClick: (id: number) => void;
}) {
  // Build a deterministic snapshot key — only changes when the inputs do.
  const snapshot = useMemo(() => ({
    tricode,
    played: played.length,
    wins: played.filter(g => (g.home_team === tricode ? g.home_pts > g.away_pts : g.away_pts > g.home_pts)).length,
    upcoming: upcoming.length,
    rosterCount: roster.length,
    fcStar: [...roster].filter(p => p.fc_bc === "FC").sort((a, b) => b.fpg - a.fpg)[0]?.id ?? null,
    bcStar: [...roster].filter(p => p.fc_bc === "BC").sort((a, b) => b.fpg - a.fpg)[0]?.id ?? null,
  }), [tricode, played, upcoming, roster]);

  // 24h localStorage cache, keyed by snapshot.
  const cacheKey = `nba:team-biq:${tricode}`;
  const assessment = useMemo(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.snapshotKey === JSON.stringify(snapshot) && Date.now() - parsed.ts < 24 * 3600_000) {
          return parsed.body;
        }
      }
    } catch {}
    const body = buildTeamAssessment(tricode, played, upcoming, roster);
    try { localStorage.setItem(cacheKey, JSON.stringify({ snapshotKey: JSON.stringify(snapshot), ts: Date.now(), body })); } catch {}
    return body;
  }, [cacheKey, snapshot, tricode, played, upcoming, roster]);

  if (!assessment) {
    return <p className="text-sm text-muted-foreground p-4">Not enough data yet.</p>;
  }

  return (
    <ScrollArea className="h-[50vh]">
      <div className="relative p-3 space-y-3">
        <div className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-400/[0.06] via-card to-card p-3">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-amber-400/90 mb-1">Team Read</p>
          <p className="text-sm leading-snug">{assessment.summary}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {assessment.standouts.map((s: any) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onPlayerClick(s.id)}
              className="text-left rounded-xl border border-border bg-card/70 p-3 hover:border-amber-400/50 hover:bg-card transition-colors"
            >
              <p className="text-[10px] font-heading font-bold uppercase tracking-[0.14em] text-amber-400/90">
                Standout · {s.fc_bc}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  {s.photo && <AvatarImage src={s.photo} />}
                  <AvatarFallback className="text-[8px]">{s.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-heading font-bold">{s.name}</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {s.fpg.toFixed(1)} FP · {s.ppg.toFixed(1)} PTS · {s.mpg.toFixed(1)} MPG
              </p>
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-3">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1">Schedule outlook</p>
          <p className="text-xs">{assessment.scheduleNote}</p>
        </div>
        <p className="text-[9px] text-muted-foreground text-center">Cached for 24h · refreshes automatically when team data changes.</p>
      </div>
    </ScrollArea>
  );
}

function buildTeamAssessment(tricode: string, played: any[], upcoming: any[], roster: any[]) {
  if (!roster.length) return null;
  const wins = played.filter(g => (g.home_team === tricode ? g.home_pts > g.away_pts : g.away_pts > g.home_pts)).length;
  const losses = played.length - wins;
  const winPct = played.length ? (wins / played.length) * 100 : 0;
  const fcStar = [...roster].filter(p => p.fc_bc === "FC").sort((a, b) => b.fpg - a.fpg)[0];
  const bcStar = [...roster].filter(p => p.fc_bc === "BC").sort((a, b) => b.fpg - a.fpg)[0];
  const standouts = [fcStar, bcStar].filter(Boolean);
  const tone = winPct >= 60 ? "playing high-leverage basketball" : winPct >= 45 ? "trending around .500" : "fighting through a tough stretch";
  const fcLine = fcStar ? `${fcStar.name} anchors the frontcourt at ${fcStar.fpg.toFixed(1)} FP.` : "";
  const bcLine = bcStar ? `${bcStar.name} runs the backcourt at ${bcStar.fpg.toFixed(1)} FP.` : "";
  const summary = `${tricode} is ${wins}-${losses} (${winPct.toFixed(0)}%), ${tone}. ${fcLine} ${bcLine}`.trim();
  const scheduleNote = upcoming.length
    ? `${upcoming.length} games remain — fantasy windows open across the slate.`
    : "No more games on the books for this team.";
  return { summary, standouts, scheduleNote };
}
