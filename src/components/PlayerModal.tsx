import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayerDetail, fetchGameBoxscore, aiExplainPlayer } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Loader2, BarChart3, Heart, Table2, Mic, Tv2 } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import PlayerCompareModal from "@/components/PlayerCompareModal";
import { useWishlist } from "@/hooks/useWishlist";

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
    <div className="bg-muted rounded-sm p-3 border shrink-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-heading font-bold uppercase text-muted-foreground">
          {view === "season" ? "Full Season Stats" : "Last Game FP Breakdown"}
        </p>
        <div className="flex gap-0.5">
          <button
            onClick={() => setView("season")}
            className={`text-[8px] font-heading font-bold px-1.5 py-0.5 rounded-sm border transition-colors ${view === "season" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            Season
          </button>
          <button
            onClick={() => setView("lastGame")}
            className={`text-[8px] font-heading font-bold px-1.5 py-0.5 rounded-sm border transition-colors ${view === "lastGame" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
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
        <DialogContent className="max-w-lg rounded-sm max-h-[85vh] flex flex-col overflow-hidden">
          {teamLogo && (
            <img src={teamLogo} alt="" aria-hidden="true" className="absolute top-4 right-4 w-20 h-20 opacity-[0.06] pointer-events-none select-none" />
          )}
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
              {/* Core Info */}
              <div className="flex items-center gap-3 shrink-0">
                {data.player.core.photo ? (
                  <img src={data.player.core.photo} alt="" className="w-14 h-14 rounded-sm object-cover bg-muted" />
                ) : (
                  <div className="w-14 h-14 rounded-sm bg-muted flex items-center justify-center text-lg font-heading font-bold text-muted-foreground">
                    {data.player.core.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-heading font-bold uppercase">{data.player.core.name}</p>
                  <div className="flex items-center gap-1.5">
                    {teamLogo && <img src={teamLogo} alt={data.player.core.team} className="w-4 h-4" />}
                    <p className="text-sm text-muted-foreground">{data.player.core.team} · #{data.player.core.jersey} · {data.player.core.pos}</p>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Badge variant={data.player.core.fc_bc === "FC" ? "destructive" : "default"} className="rounded-sm">
                      {data.player.core.fc_bc}
                    </Badge>
                    <span className="text-sm font-mono">${data.player.core.salary}</span>
                  </div>
                </div>
                {/* Action buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setCompareOpen(true)}
                    className="p-2 rounded-sm bg-primary/20 hover:bg-primary/30 transition-colors"
                    title="Compare"
                  >
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </button>
                  <button
                    onClick={() => playerId && toggleWishlist(playerId)}
                    className="p-2 rounded-sm bg-muted hover:bg-muted/80 transition-colors"
                    title={wishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                  >
                    <Heart className={`h-4 w-4 ${wishlisted ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
                  </button>
                </div>
              </div>

              {/* FP Breakdown */}
              <BreakdownCard data={data} />

              <Tabs defaultValue="stats" className="flex-1 min-h-0 flex flex-col">
                <TabsList className="rounded-sm shrink-0">
                  <TabsTrigger value="stats" className="font-heading text-xs uppercase rounded-sm">Stats</TabsTrigger>
                  <TabsTrigger value="history" className="font-heading text-xs uppercase rounded-sm">History</TabsTrigger>
                  <TabsTrigger value="schedule" className="font-heading text-xs uppercase rounded-sm">Schedule</TabsTrigger>
                  <TabsTrigger value="ai" className="font-heading text-xs uppercase rounded-sm">AI Explain</TabsTrigger>
                </TabsList>

                {/* Stats Tab */}
                <TabsContent value="stats" className="shrink-0">
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
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history" className="flex-1 min-h-0">
                  <p className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2">This Season</p>
                  {data.history.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No history available</p>
                  ) : (
                    <ScrollArea className="h-[40vh]">
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
                                className="hover:bg-accent/50"
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
                                    <span className={`p-0.5 ${h.game_recap_url ? "text-green-500" : "text-muted-foreground/30"}`} title="Video Recap">
                                      <Tv2 className="h-3 w-3" />
                                    </span>
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
                <TabsContent value="schedule" className="flex-1 min-h-0">
                  {data.upcoming.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No upcoming games</p>
                  ) : (
                    <ScrollArea className="h-[40vh]">
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
                <TabsContent value="ai" className="shrink-0">
                  <div className="space-y-3">
                    <Button size="sm" onClick={handleExplain} disabled={aiLoading} className="w-full">
                      {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bot className="h-4 w-4 mr-2" />}
                      {aiLoading ? "Analyzing..." : "Ask AI"}
                    </Button>
                    {aiLoading && <Skeleton className="h-20 w-full" />}
                    {aiResult && (
                      <div className="space-y-2 text-sm">
                        <p className="font-semibold">{aiResult.summary}</p>
                        <div>
                          <p className="text-[10px] font-heading font-bold text-muted-foreground uppercase mb-1">Scoring Factors</p>
                          {aiResult.why_it_scores.map((f: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs mb-1">
                              <Badge variant="outline" className="rounded-sm text-[9px]">{f.factor}</Badge>
                              <Badge variant={f.impact === "very_high" || f.impact === "high" ? "default" : "secondary"} className="rounded-sm text-[9px]">{f.impact}</Badge>
                              <span>{f.note}</span>
                            </div>
                          ))}
                        </div>
                        {aiResult.trend_flags.length > 0 && (
                          <div>
                            <p className="text-[10px] font-heading font-bold text-muted-foreground uppercase mb-1">Trends</p>
                            {aiResult.trend_flags.map((t: any, i: number) => (
                              <div key={i} className="text-xs flex gap-1 items-center mb-1">
                                <Badge variant="outline" className="rounded-sm text-[9px]">{t.type}</Badge>
                                <span>{t.detail}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Badge variant={aiResult.recommendation.action === "add" ? "default" : aiResult.recommendation.action === "drop" ? "destructive" : "secondary"} className="rounded-sm">
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
        <DialogContent className="max-w-lg rounded-sm max-h-[85vh] flex flex-col overflow-hidden">
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
                          <Badge variant={p.fc_bc === "FC" ? "destructive" : "default"} className="rounded-sm text-[8px] px-1 py-0">{p.fc_bc}</Badge>
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
    </>
  );
}
