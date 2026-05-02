import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayerDetail, fetchGameBoxscore, aiExplainPlayer } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Loader2, BarChart3, Heart, Table2, Mic, Tv2, ExternalLink } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import PlayerCompareModal from "@/components/PlayerCompareModal";
import { useWishlist } from "@/hooks/useWishlist";
import nbaLogo from "@/assets/nba-logo.svg";
import GameDetailModal, { type GameDetailGame } from "@/components/GameDetailModal";
import BallersIQPlayerVerdict from "@/components/ballers-iq/BallersIQPlayerVerdict";
import { getBallersIQInsights } from "@/lib/ballers-iq";

function BreakdownCard({ data }: { data: any }) {
  const [view, setView] = useState<"season" | "lastGame">("season");
  const season = data.player.season;
  const lastGame = data.player.lastGame;

  const seasonItems = [
    { label: "PTS", val: Number(season.pts ?? 0).toFixed(1) },
    { label: "REB", val: Number(season.reb ?? 0).toFixed(1) },
    { label: "AST", val: Number(season.ast ?? 0).toFixed(1) },
    { label: "STL", val: Number(season.stl ?? 0).toFixed(1) },
    { label: "BLK", val: Number(season.blk ?? 0).toFixed(1) },
    { label: "FP", val: Number(season.fp ?? 0).toFixed(1) },
  ];

  const lastGameItems = [
    { label: "PTS", val: String(lastGame.pts * 1) },
    { label: "REB", val: String(lastGame.reb * 1) },
    { label: "AST ×2", val: String(lastGame.ast * 2) },
    { label: "STL ×3", val: String(lastGame.stl * 3) },
    { label: "BLK ×3", val: String(lastGame.blk * 3) },
    { label: "FP", val: Number(lastGame.fp).toFixed(1) },
  ];

  const items = view === "season" ? seasonItems : lastGameItems;

  return (
    <div className="bg-muted rounded-lg p-3 border shrink-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-heading font-bold uppercase text-muted-foreground">
          {view === "season" ? "Full Season Stats" : "Last Game FP Breakdown"}
        </p>
        <div className="flex gap-0.5">
          <button
            onClick={() => setView("season")}
            className={`text-[8px] font-heading font-bold px-1.5 py-0.5 rounded-lg border transition-colors ${view === "season" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            Season
          </button>
          <button
            onClick={() => setView("lastGame")}
            className={`text-[8px] font-heading font-bold px-1.5 py-0.5 rounded-lg border transition-colors ${view === "lastGame" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            Last Game
          </button>
        </div>
      </div>
      <div className="grid grid-cols-6 gap-2 text-center text-xs">
        {items.map(({ label, val }) => (
          <div key={label}>
            <p className="text-muted-foreground font-heading text-[10px]">{label}</p>
            <p className="font-mono font-bold">{val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PlayerModalProps {
  playerId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PlayerModal({ playerId, open, onOpenChange }: PlayerModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["player-detail", playerId],
    queryFn: () => fetchPlayerDetail(playerId!),
    enabled: open && playerId !== null,
  });

  const [aiResult, setAiResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [boxscoreGameId, setBoxscoreGameId] = useState<string | null>(null);
  const [boxscorePlayerId, setBoxscorePlayerId] = useState<number | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameDetailGame | null>(null);
  const { isInWishlist, toggleWishlist } = useWishlist();

  const { data: boxscoreData, isLoading: boxscoreLoading } = useQuery({
    queryKey: ["game-boxscore", boxscoreGameId],
    queryFn: () => fetchGameBoxscore(boxscoreGameId!),
    enabled: !!boxscoreGameId,
  });

  const handleExplain = async () => {
    if (!playerId) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await aiExplainPlayer({ player_id: playerId });
      setAiResult(res);
    } catch {
      setAiResult(null);
    } finally {
      setAiLoading(false);
    }
  };

  const handleBoxscorePlayerClick = (pid: number) => {
    setBoxscoreGameId(null);
    setBoxscorePlayerId(pid);
  };

  if (!open) return null;

  const teamLogo = data ? getTeamLogo(data.player.core.team) : undefined;
  const wishlisted = playerId ? isInWishlist(playerId) : false;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setAiResult(null); setBoxscoreGameId(null); } }}>
        <DialogContent className="max-w-lg rounded-lg h-[85vh] flex flex-col overflow-hidden">
          {/* NBA logo watermark — visible on every tab */}
          <img
            src={nbaLogo}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-auto w-1/3 max-w-[160px] opacity-[0.04] select-none"
          />
          <DialogHeader className="sr-only">
            <DialogTitle>{isLoading ? "Loading…" : data?.player?.core?.name ?? "Player"}</DialogTitle>
          </DialogHeader>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : data ? (
            <div className="flex flex-col min-h-0 flex-1 gap-4">
              {/* Premium Header — watermark team logo, oversized, rotated */}
              <div className="relative overflow-hidden rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-3 shadow-[0_4px_20px_-8px_hsl(var(--primary)/0.4)] shrink-0">
                {teamLogo && (
                  <img
                    src={teamLogo}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-8 -right-8 h-44 w-44 object-contain opacity-[0.18] rotate-12 select-none"
                  />
                )}
                <div className="relative z-10 flex items-center gap-3">
                  {data.player.core.photo ? (
                    <img src={data.player.core.photo} alt="" className="w-16 h-16 rounded-lg object-cover object-top bg-muted ring-2 ring-background" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-lg font-heading font-bold text-muted-foreground ring-2 ring-background">
                      {data.player.core.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold uppercase truncate">{data.player.core.name}</p>
                    <div className="flex items-center gap-1.5">
                      {teamLogo && <img src={teamLogo} alt={data.player.core.team} className="w-4 h-4" />}
                      <p className="text-xs text-muted-foreground">
                        {data.player.core.team} · #{data.player.core.jersey} · {data.player.core.pos}
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground/80 truncate">
                      {data.player.core.height ?? "—"}
                      {data.player.core.college ? ` · ${data.player.core.college}` : ""}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant={data.player.core.fc_bc === "FC" ? "destructive" : "default"} className="rounded-lg">
                        {data.player.core.fc_bc}
                      </Badge>
                      <span className="font-mono text-sm font-bold px-2 py-0.5 rounded-md bg-foreground/10 border border-foreground/20">
                        ${data.player.core.salary}M
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setCompareOpen(true)}
                      className="p-1.5 hover:text-primary transition-colors"
                      title="Compare"
                    >
                      <BarChart3 className="h-4 w-4 text-primary" />
                    </button>
                    <button
                      onClick={() => playerId && toggleWishlist(playerId)}
                      className="p-1.5 hover:text-destructive transition-colors"
                      title={wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                    >
                      <Heart className={`h-4 w-4 ${wishlisted ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* FP Breakdown */}
              <BreakdownCard data={data} />

              {/* Ballers.IQ Verdict — grounded in app data */}
              {(() => {
                const c = data.player.core as any;
                const season = (data.player as any).season ?? {};
                const last5 = (data.player as any).last5 ?? {};
                const computed = (data.player as any).computed ?? {};
                const verdict = getBallersIQInsights("player", {
                  player: {
                    id: c.id, name: c.name, team: c.team, fc_bc: c.fc_bc, salary: c.salary,
                    fp_pg5: last5.fp5, fp_pg_t: season.fp,
                    value5: computed.value5 ?? last5.value5,
                    mpg: season.mpg, mpg5: last5.mpg5,
                    stl5: last5.stl5, blk5: last5.blk5, ast5: last5.ast5,
                    delta_fp: computed.delta_fp ?? last5.delta_fp,
                    delta_mpg: computed.delta_mpg ?? last5.delta_mpg,
                    injury: c.injury,
                  },
                });
                return verdict.insights[0] ? (
                  <BallersIQPlayerVerdict insight={verdict.insights[0]} />
                ) : null;
              })()}

              <Tabs defaultValue="stats" className="flex-1 min-h-0 flex flex-col">
                <TabsList className="rounded-lg shrink-0">
                  <TabsTrigger value="stats" className="font-heading text-xs uppercase rounded-lg">Stats</TabsTrigger>
                  <TabsTrigger value="history" className="font-heading text-xs uppercase rounded-lg">History</TabsTrigger>
                  <TabsTrigger value="schedule" className="font-heading text-xs uppercase rounded-lg">Schedule</TabsTrigger>
                  <TabsTrigger value="ai" className="font-heading text-xs uppercase rounded-lg">AI Explain</TabsTrigger>
                </TabsList>

                {/* Stats Tab */}
                <TabsContent value="stats" className="flex-1 min-h-0 mt-3 overflow-y-auto data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { l: "Season FP/G", v: data.player.season.fp.toFixed(1) },
                      { l: "Last 5 FP/G", v: data.player.last5.fp5.toFixed(1) },
                      { l: "MPG (season)", v: data.player.season.mpg?.toFixed(1) ?? "—" },
                      { l: "MPG (L5)", v: data.player.last5.mpg5?.toFixed(1) ?? "—" },
                      { l: "Value (season)", v: data.player.computed.value.toFixed(2) },
                      { l: "Value (L5)", v: data.player.computed.value5.toFixed(2) },
                      { l: "Stocks (L5)", v: data.player.computed.stocks5.toFixed(1) },
                      { l: "Δ FP", v: `${data.player.computed.delta_fp >= 0 ? "+" : ""}${data.player.computed.delta_fp.toFixed(1)}`, color: data.player.computed.delta_fp >= 0 },
                    ].map(({ l, v, color }) => (
                      <div key={l}>
                        <p className="text-muted-foreground text-[10px] font-heading uppercase">{l}</p>
                        <p className={`font-mono font-bold ${color === true ? "text-green-600" : color === false ? "text-destructive" : ""}`}>{v}</p>
                      </div>
                    ))}
                  </div>
                  {/* Advanced Stats — End-of-Regular-Season totals */}
                  {data.player.advanced && (
                    <div className="mt-4 rounded-lg border bg-muted/50 p-3">
                      <p className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2">
                        Advanced (End of Regular Season)
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        {[
                          { l: "FG%", v: data.player.advanced.fg_pct != null ? `${(data.player.advanced.fg_pct * 100).toFixed(1)}%` : "—" },
                          { l: "3P%", v: data.player.advanced.tp_pct != null ? `${(data.player.advanced.tp_pct * 100).toFixed(1)}%` : "—" },
                          { l: "FT%", v: data.player.advanced.ft_pct != null ? `${(data.player.advanced.ft_pct * 100).toFixed(1)}%` : "—" },
                          { l: "OREB", v: data.player.advanced.oreb ?? "—" },
                          { l: "DREB", v: data.player.advanced.dreb ?? "—" },
                          { l: "TOV", v: data.player.advanced.tov ?? "—" },
                          { l: "PF", v: data.player.advanced.pf ?? "—" },
                          { l: "+/-", v: data.player.advanced.plus_minus != null
                              ? `${data.player.advanced.plus_minus > 0 ? "+" : ""}${data.player.advanced.plus_minus}`
                              : "—",
                            color: data.player.advanced.plus_minus != null ? data.player.advanced.plus_minus >= 0 : undefined,
                          },
                          { l: "3PM/3PA", v: data.player.advanced.tpm != null && data.player.advanced.tpa != null
                              ? `${data.player.advanced.tpm}/${data.player.advanced.tpa}` : "—" },
                        ].map(({ l, v, color }: any) => (
                          <div key={l}>
                            <p className="text-muted-foreground font-heading text-[9px]">{l}</p>
                            <p className={`font-mono font-bold text-xs ${color === true ? "text-green-600" : color === false ? "text-destructive" : ""}`}>{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history" className="flex-1 min-h-0 mt-3 data-[state=active]:flex data-[state=active]:flex-col">
                  <p className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2 shrink-0">This Season</p>
                  {data.history.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 text-left">No history available</p>
                  ) : (
                    <ScrollArea className="flex-1 min-h-0">
                      <div className="pr-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8">GD</TableHead>
                            <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8">OPP</TableHead>
                            <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8 text-right">PTS</TableHead>
                            <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8 text-right">MP</TableHead>
                            <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8 text-right">PS</TableHead>
                            <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8 text-right">R</TableHead>
                            <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8 text-right">A</TableHead>
                            <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8 text-right">B</TableHead>
                            <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8 text-right">S</TableHead>
                            <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8 text-center">Links</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.history.map((h: any, i: number) => {
                            const isAway = h.home_away === "A";
                            const oppTeam = isAway ? h.home_team : h.away_team;
                            const oppLogo = getTeamLogo(oppTeam);
                            const myScore = isAway ? h.away_pts : h.home_pts;
                            const oppScore = isAway ? h.home_pts : h.away_pts;
                            return (
                              <TableRow
                                key={i}
                                className="hover:bg-accent/50 cursor-pointer"
                                onClick={() => setSelectedGame({
                                  game_id: h.game_id,
                                  home_team: h.home_team,
                                  away_team: h.away_team,
                                  home_pts: h.home_pts,
                                  away_pts: h.away_pts,
                                  game_boxscore_url: h.game_boxscore_url ?? null,
                                  game_charts_url: h.game_charts_url ?? null,
                                  game_playbyplay_url: h.game_playbyplay_url ?? null,
                                  game_recap_url: h.game_recap_url ?? null,
                                  nba_game_url: h.nba_game_url ?? null,
                                  played: true,
                                })}
                              >
                                <TableCell className="px-1.5 py-1 text-xs font-bold font-mono whitespace-nowrap">
                                  GW{h.gw}.{h.day}
                                </TableCell>
                                <TableCell className="px-1.5 py-1 text-xs whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    {oppLogo && <img src={oppLogo} alt="" className="w-3.5 h-3.5" />}
                                    <span>{isAway ? "@" : "vs."}{oppTeam}</span>
                                    <span className="text-muted-foreground ml-1">{myScore}-{oppScore}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="px-1.5 py-1 text-xs font-bold font-mono text-right">{h.fp.toFixed(1)}</TableCell>
                                <TableCell className="px-1.5 py-1 text-xs font-mono text-right">{h.mp}</TableCell>
                                <TableCell className="px-1.5 py-1 text-xs font-mono text-right">{h.pts}</TableCell>
                                <TableCell className="px-1.5 py-1 text-xs font-mono text-right">{h.reb}</TableCell>
                                <TableCell className="px-1.5 py-1 text-xs font-mono text-right">{h.ast}</TableCell>
                                <TableCell className="px-1.5 py-1 text-xs font-mono text-right">{h.blk}</TableCell>
                                <TableCell className="px-1.5 py-1 text-xs font-mono text-right">{h.stl}</TableCell>
                                <TableCell className="px-1.5 py-1">
                                  <div className="flex items-center justify-center gap-0.5">
                                    <button onClick={() => setBoxscoreGameId(h.game_id)} className="text-muted-foreground hover:text-primary transition-colors p-0.5" title="Box Score">
                                      <Table2 className="h-3 w-3" />
                                    </button>
                                    {h.game_charts_url && (
                                      <a href={h.game_charts_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-0.5" title="Charts">
                                        <BarChart3 className="h-3 w-3" />
                                      </a>
                                    )}
                                    {h.game_playbyplay_url && (
                                      <a href={h.game_playbyplay_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors p-0.5" title="Play-by-Play">
                                        <Mic className="h-3 w-3" />
                                      </a>
                                    )}
                                    {h.game_recap_url ? (
                                      <a
                                        href={h.game_recap_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-green-500 hover:text-green-400 transition-colors p-0.5"
                                        title="Watch Recap on NBA.com"
                                      >
                                        <Tv2 className="h-3 w-3" />
                                      </a>
                                    ) : (
                                      <span className="p-0.5 text-muted-foreground/30" title="Recap unavailable">
                                        <Tv2 className="h-3 w-3" />
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                {/* Schedule Tab */}
                <TabsContent value="schedule" className="flex-1 min-h-0 mt-3 data-[state=active]:flex data-[state=active]:flex-col">
                  <p className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2 shrink-0">Upcoming Games</p>
                  {data.upcoming.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 text-left">No upcoming games</p>
                  ) : (
                    <ScrollArea className="flex-1 min-h-0">
                      <div className="pr-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8">Date</TableHead>
                            <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8">GD</TableHead>
                            <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8">Opponent</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.upcoming.map((g: any, i: number) => {
                            const playerTeam = data.player.core.team;
                            const isAway = g.away_team === playerTeam;
                            const oppTeam = isAway ? g.home_team : g.away_team;
                            const oppLogo = getTeamLogo(oppTeam);
                            const dateStr = g.tipoff_utc ? format(new Date(g.tipoff_utc), "MMM d, HH:mm") : "TBD";
                            return (
                              <TableRow key={i}>
                                <TableCell className="px-1.5 py-1.5 text-xs whitespace-nowrap">{dateStr}</TableCell>
                                <TableCell className="px-1.5 py-1.5 text-xs font-mono font-bold whitespace-nowrap">
                                  Gameweek {g.gw} - Day {g.day}
                                </TableCell>
                                <TableCell className="px-1.5 py-1.5 text-xs whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    {oppLogo && <img src={oppLogo} alt="" className="w-3.5 h-3.5" />}
                                    <span>{isAway ? "@" : "vs."}{oppTeam}</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                {/* AI Tab */}
                <TabsContent value="ai" className="flex-1 min-h-0 mt-3 gap-3 data-[state=active]:flex data-[state=active]:flex-col">
                  <Button size="sm" onClick={handleExplain} disabled={aiLoading} className="w-full shrink-0">
                    {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bot className="h-4 w-4 mr-2" />}
                    {aiLoading ? "Analyzing..." : "Ask AI"}
                  </Button>
                  <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                    {aiLoading && <Skeleton className="h-20 w-full" />}
                    {aiResult && (
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold">{aiResult.summary}</p>
                        <div>
                          <p className="text-[10px] font-heading font-bold text-muted-foreground uppercase mb-1">Scoring Factors</p>
                          {aiResult.why_it_scores.map((f: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs mb-1">
                              <Badge variant="outline" className="rounded-lg text-[9px]">{f.factor}</Badge>
                              <Badge variant={f.impact === "very_high" || f.impact === "high" ? "default" : "secondary"} className="rounded-lg text-[9px]">{f.impact}</Badge>
                              <span>{f.note}</span>
                            </div>
                          ))}
                        </div>
                        {aiResult.trend_flags.length > 0 && (
                          <div>
                            <p className="text-[10px] font-heading font-bold text-muted-foreground uppercase mb-1">Trends</p>
                            {aiResult.trend_flags.map((t: any, i: number) => (
                              <div key={i} className="text-xs flex gap-1 items-center mb-1">
                                <Badge variant="outline" className="rounded-lg text-[9px]">{t.type}</Badge>
                                <span>{t.detail}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Badge variant={aiResult.recommendation.action === "add" ? "default" : aiResult.recommendation.action === "drop" ? "destructive" : "secondary"} className="rounded-lg">
                            {aiResult.recommendation.action.toUpperCase()}
                          </Badge>
                          <span className="text-xs">{aiResult.recommendation.rationale}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Game Boxscore Dialog */}
      <Dialog open={!!boxscoreGameId} onOpenChange={(o) => { if (!o) setBoxscoreGameId(null); }}>
        <DialogContent className="max-w-lg rounded-lg max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="font-heading">Game Box Score</DialogTitle>
          </DialogHeader>
          {boxscoreLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : boxscoreData ? (
            <ScrollArea className="h-[50vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8">Player</TableHead>
                    <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8 text-right">FP</TableHead>
                    <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8 text-right">MP</TableHead>
                    <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8 text-right">PS</TableHead>
                    <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8 text-right">R</TableHead>
                    <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8 text-right">A</TableHead>
                    <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8 text-right">B</TableHead>
                    <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8 text-right">S</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boxscoreData.players.map((p: any) => (
                    <TableRow
                      key={p.player_id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleBoxscorePlayerClick(p.player_id)}
                    >
                      <TableCell className="px-1.5 py-1 text-xs">
                        <div className="flex items-center gap-1.5">
                          {p.photo ? (
                            <img src={p.photo} alt="" className="w-5 h-5 rounded-full object-cover" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-muted" />
                          )}
                          <span className="font-medium whitespace-nowrap">{p.name}</span>
                          <Badge variant={p.fc_bc === "FC" ? "destructive" : "default"} className="rounded-lg text-[8px] px-1 py-0">{p.fc_bc}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-xs font-bold font-mono text-right">{p.fp.toFixed(1)}</TableCell>
                      <TableCell className="px-1.5 py-1 text-xs font-mono text-right">{p.mp}</TableCell>
                      <TableCell className="px-1.5 py-1 text-xs font-mono text-right">{p.ps}</TableCell>
                      <TableCell className="px-1.5 py-1 text-xs font-mono text-right">{p.reb}</TableCell>
                      <TableCell className="px-1.5 py-1 text-xs font-mono text-right">{p.ast}</TableCell>
                      <TableCell className="px-1.5 py-1 text-xs font-mono text-right">{p.blk}</TableCell>
                      <TableCell className="px-1.5 py-1 text-xs font-mono text-right">{p.stl}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No box score data</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Nested player modal from boxscore click */}
      {boxscorePlayerId && (
        <PlayerModal
          playerId={boxscorePlayerId}
          open={!!boxscorePlayerId}
          onOpenChange={(o) => { if (!o) setBoxscorePlayerId(null); }}
        />
      )}

      {/* Compare modal */}
      {data && compareOpen && (
        <PlayerCompareModal
          open={compareOpen}
          onOpenChange={setCompareOpen}
          playerA={{
            id: data.player.core.id,
            name: data.player.core.name,
            team: data.player.core.team,
            photo: data.player.core.photo,
            fc_bc: data.player.core.fc_bc,
            salary: data.player.core.salary,
            season: data.player.season,
            computed: data.player.computed,
          }}
        />
      )}

      <GameDetailModal
        game={selectedGame}
        open={selectedGame !== null}
        onOpenChange={(o) => !o && setSelectedGame(null)}
      />
    </>
  );
}
