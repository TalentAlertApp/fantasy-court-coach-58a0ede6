import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayerDetail, fetchGameBoxscore, aiExplainPlayer } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Loader2 } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";

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

  if (!open) return null;

  const teamLogo = data ? getTeamLogo(data.player.core.team) : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setAiResult(null); setBoxscoreGameId(null); } }}>
        <DialogContent className="max-w-lg rounded-sm max-h-[85vh] overflow-hidden flex flex-col">
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
            <div className="space-y-4">
              {/* Core Info */}
              <div className="flex items-center gap-3">
                {data.player.core.photo ? (
                  <img src={data.player.core.photo} alt="" className="w-14 h-14 rounded-sm object-cover bg-muted" />
                ) : (
                  <div className="w-14 h-14 rounded-sm bg-muted flex items-center justify-center text-lg font-heading font-bold text-muted-foreground">
                    {data.player.core.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
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
              </div>

              {/* Last Game FP Breakdown */}
              <div className="bg-muted rounded-sm p-3 border">
                <p className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2">Last Game FP Breakdown</p>
                <div className="grid grid-cols-6 gap-2 text-center text-xs">
                  {[
                    { label: "PTS", val: data.player.lastGame.pts, mult: 1 },
                    { label: "REB", val: data.player.lastGame.reb, mult: 1 },
                    { label: "AST", val: data.player.lastGame.ast, mult: 2 },
                    { label: "STL", val: data.player.lastGame.stl, mult: 3 },
                    { label: "BLK", val: data.player.lastGame.blk, mult: 3 },
                    { label: "FP", val: data.player.lastGame.fp, mult: 0 },
                  ].map(({ label, val, mult }) => (
                    <div key={label}>
                      <p className="text-muted-foreground font-heading text-[10px]">{label}{mult > 1 ? ` ×${mult}` : ""}</p>
                      <p className="font-mono font-bold">{mult > 0 ? val * mult : val.toFixed(1)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Tabs defaultValue="stats" className="flex-1 min-h-0 flex flex-col">
                <TabsList className="rounded-sm shrink-0">
                  <TabsTrigger value="stats" className="font-heading text-xs uppercase rounded-sm">Stats</TabsTrigger>
                  <TabsTrigger value="history" className="font-heading text-xs uppercase rounded-sm">History</TabsTrigger>
                  <TabsTrigger value="schedule" className="font-heading text-xs uppercase rounded-sm">Schedule</TabsTrigger>
                  <TabsTrigger value="ai" className="font-heading text-xs uppercase rounded-sm">AI Explain</TabsTrigger>
                </TabsList>

                {/* Stats Tab */}
                <TabsContent value="stats">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { l: "Season FP/G", v: data.player.season.fp.toFixed(1) },
                      { l: "Last 5 FP/G", v: data.player.last5.fp5.toFixed(1) },
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
                <TabsContent value="history">
                  <p className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-2">This Season</p>
                  {data.history.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No history available</p>
                  ) : (
                    <ScrollArea className="max-h-[60vh]">
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
                                className="cursor-pointer hover:bg-accent/50"
                                onClick={() => setBoxscoreGameId(h.game_id)}
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
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </TabsContent>

                {/* Schedule Tab */}
                <TabsContent value="schedule">
                  {data.upcoming.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No upcoming games</p>
                  ) : (
                    <ScrollArea className="max-h-[60vh]">
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
                    </ScrollArea>
                  )}
                </TabsContent>

                {/* AI Tab */}
                <TabsContent value="ai">
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
        <DialogContent className="max-w-lg rounded-sm overflow-hidden">
          <DialogHeader>
            <DialogTitle className="font-heading">Game Box Score</DialogTitle>
          </DialogHeader>
          {boxscoreLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : boxscoreData ? (
            <ScrollArea className="max-h-80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] font-heading uppercase px-1.5 h-8">Player</TableHead>
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
                  {boxscoreData.players.map((p: any) => (
                    <TableRow key={p.player_id}>
                      <TableCell className="px-1.5 py-1 text-xs">
                        <div className="flex items-center gap-1.5">
                          {p.photo ? (
                            <img src={p.photo} alt="" className="w-5 h-5 rounded-full object-cover" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-muted" />
                          )}
                          <span className="font-medium truncate max-w-[100px]">{p.name}</span>
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
    </>
  );
}
