import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, ArrowLeftRight, Star, HelpCircle, Activity, Shield, Loader2, AlertTriangle } from "lucide-react";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useTeam } from "@/contexts/TeamContext";
import {
  aiAnalyzeRoster,
  aiPickCaptain,
  aiSuggestTransfers,
  aiInjuryMonitor,
  aiExplainPlayer,
  saveRoster,
  simulateTransactions,
  commitTransaction,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

export default function AIHubPage() {
  const { toast } = useToast();
  const { selectedTeamId, teams } = useTeam();
  const { data: rosterData } = useRosterQuery();
  const { data: playersData } = usePlayersQuery();

  // State for each panel
  const [analyzeResult, setAnalyzeResult] = useState<any>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);

  const [captainResult, setCaptainResult] = useState<any>(null);
  const [captainLoading, setCaptainLoading] = useState(false);

  const [transfersResult, setTransfersResult] = useState<any>(null);
  const [transfersLoading, setTransfersLoading] = useState(false);

  const [injuryResult, setInjuryResult] = useState<any>(null);
  const [injuryLoading, setInjuryLoading] = useState(false);

  const [explainResult, setExplainResult] = useState<any>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainSearch, setExplainSearch] = useState("");

  const [applyingCaptain, setApplyingCaptain] = useState(false);
  const [simulatingIdx, setSimulatingIdx] = useState<number | null>(null);
  const [committingIdx, setCommittingIdx] = useState<number | null>(null);
  const [simResults, setSimResults] = useState<Record<number, any>>({});

  const gw = rosterData?.roster?.gw ?? 1;
  const day = rosterData?.roster?.day ?? 1;

  const getPlayerName = (id: number) => {
    const p = playersData?.items?.find((i: any) => i.core.id === id);
    return p?.core?.name ?? `#${id}`;
  };

  const handleAnalyze = async () => {
    setAnalyzeLoading(true);
    setAnalyzeResult(null);
    try {
      const res = await aiAnalyzeRoster({ gw, day, focus: "balanced" }, selectedTeamId ?? undefined);
      setAnalyzeResult(res);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const handleCaptain = async () => {
    setCaptainLoading(true);
    setCaptainResult(null);
    try {
      const res = await aiPickCaptain({ gw, day }, selectedTeamId ?? undefined);
      setCaptainResult(res);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setCaptainLoading(false);
    }
  };

  const handleApplyCaptain = async () => {
    if (!captainResult || !rosterData) return;
    setApplyingCaptain(true);
    try {
      await saveRoster({
        gw,
        day,
        starters: rosterData.roster.starters,
        bench: rosterData.roster.bench,
        captain_id: captainResult.captain_id,
      }, selectedTeamId ?? undefined);
      toast({ title: "Captain applied!" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setApplyingCaptain(false);
    }
  };

  const handleTransfers = async () => {
    setTransfersLoading(true);
    setTransfersResult(null);
    setSimResults({});
    try {
      const res = await aiSuggestTransfers({ gw, day, max_cost: rosterData?.roster?.bank_remaining ?? 100, objective: "maximize_fp5" }, selectedTeamId ?? undefined);
      setTransfersResult(res);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setTransfersLoading(false);
    }
  };

  const handleSimulate = async (idx: number, move: any) => {
    setSimulatingIdx(idx);
    try {
      const res = await simulateTransactions({ gw, day, adds: [move.add], drops: [move.drop] }, selectedTeamId ?? undefined);
      setSimResults((prev) => ({ ...prev, [idx]: res }));
    } catch (e: any) {
      toast({ title: "Sim Error", description: e.message, variant: "destructive" });
    } finally {
      setSimulatingIdx(null);
    }
  };

  const handleCommit = async (idx: number, move: any) => {
    setCommittingIdx(idx);
    try {
      await commitTransaction({ gw, day, adds: [move.add], drops: [move.drop] }, selectedTeamId ?? undefined);
      toast({ title: "Transfer committed!" });
    } catch (e: any) {
      toast({ title: "Commit Error", description: e.message, variant: "destructive" });
    } finally {
      setCommittingIdx(null);
    }
  };

  const handleInjury = async () => {
    setInjuryLoading(true);
    setInjuryResult(null);
    try {
      const rosterPlayerIds = rosterData?.roster
        ? [...rosterData.roster.starters, ...rosterData.roster.bench]
        : [];
      const res = await aiInjuryMonitor({ player_ids: rosterPlayerIds, include_replacements: true, max_salary: rosterData?.roster?.bank_remaining ?? null }, selectedTeamId ?? undefined);
      setInjuryResult(res);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setInjuryLoading(false);
    }
  };

  const handleExplain = async () => {
    if (!explainSearch.trim()) return;
    const player = playersData?.items?.find((i: any) =>
      i.core.name.toLowerCase().includes(explainSearch.toLowerCase())
    );
    if (!player) {
      toast({ title: "Player not found", variant: "destructive" });
      return;
    }
    setExplainLoading(true);
    setExplainResult(null);
    try {
      const res = await aiExplainPlayer({ player_id: player.core.id }, selectedTeamId ?? undefined);
      setExplainResult(res);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setExplainLoading(false);
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "OUT": return "destructive";
      case "Q": return "secondary";
      case "DTD": return "outline";
      default: return "default";
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-8">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-lg font-bold">{teams.find((t: any) => t.id === selectedTeamId)?.name ?? "My Team"}</h2>
        <span className="text-sm text-muted-foreground">— AI Coach</span>
      </div>
      <div className="text-center py-4">
        <Bot className="h-10 w-10 mx-auto mb-3 text-primary" />
        <p className="text-sm text-muted-foreground">Powered by GPT-4.1 Mini with real-time NBA search</p>
      </div>

      {/* 1. Analyze Roster */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 p-4">
          <Activity className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <CardTitle className="text-base">Analyze My Roster</CardTitle>
            <CardDescription>Get strengths, weaknesses, and quick wins</CardDescription>
          </div>
          <Button size="sm" onClick={handleAnalyze} disabled={analyzeLoading}>
            {analyzeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze"}
          </Button>
        </CardHeader>
        {analyzeLoading && <CardContent><Skeleton className="h-24 w-full" /></CardContent>}
        {analyzeResult && (
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">Summary</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {analyzeResult.summary_bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-semibold text-xs uppercase text-green-600 mb-1">Strengths</p>
                <ul className="list-disc pl-4 space-y-0.5">{analyzeResult.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
              </div>
              <div>
                <p className="font-semibold text-xs uppercase text-destructive mb-1">Weaknesses</p>
                <ul className="list-disc pl-4 space-y-0.5">{analyzeResult.weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>
              </div>
            </div>
            {analyzeResult.quick_wins.length > 0 && (
              <div>
                <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">Quick Wins</p>
                {analyzeResult.quick_wins.map((qw: any, i: number) => (
                  <div key={i} className="bg-muted rounded p-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{qw.title}</span>
                      <Badge variant="outline" className="text-xs">{Math.round(qw.confidence * 100)}%</Badge>
                    </div>
                    <ul className="list-disc pl-4 text-xs mt-1">{qw.why.map((w: string, j: number) => <li key={j}>{w}</li>)}</ul>
                    {qw.risk_flags.length > 0 && (
                      <div className="flex gap-1 mt-1">{qw.risk_flags.map((f: string, j: number) => <Badge key={j} variant="destructive" className="text-xs">{f}</Badge>)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {analyzeResult.recommended_actions.length > 0 && (
              <div>
                <p className="font-semibold text-xs uppercase text-muted-foreground mb-1">Recommended Actions</p>
                {analyzeResult.recommended_actions.map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Badge>{a.type}</Badge>
                    <span>{a.note}</span>
                  </div>
                ))}
              </div>
            )}
            {analyzeResult.notes.length > 0 && (
              <p className="text-xs text-muted-foreground italic">{analyzeResult.notes.join(" · ")}</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* 2. Pick Captain */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 p-4">
          <Star className="h-5 w-5 text-nba-yellow" />
          <div className="flex-1">
            <CardTitle className="text-base">Best Captain Today</CardTitle>
            <CardDescription>AI recommends your optimal captain</CardDescription>
          </div>
          <Button size="sm" onClick={handleCaptain} disabled={captainLoading}>
            {captainLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pick"}
          </Button>
        </CardHeader>
        {captainLoading && <CardContent><Skeleton className="h-16 w-full" /></CardContent>}
        {captainResult && (
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <div>
                <p className="font-semibold">Captain: {getPlayerName(captainResult.captain_id)}</p>
                <Badge variant="outline" className="text-xs">{Math.round(captainResult.confidence * 100)}% confidence</Badge>
              </div>
              <Button size="sm" variant="default" className="ml-auto bg-nba-yellow text-foreground hover:bg-nba-yellow/80" onClick={handleApplyCaptain} disabled={applyingCaptain}>
                {applyingCaptain ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply Captain"}
              </Button>
            </div>
            <ul className="list-disc pl-4 text-xs space-y-0.5">
              {captainResult.reason_bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}
            </ul>
            {captainResult.alternatives.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium">Alternatives:</p>
                {captainResult.alternatives.map((alt: any) => (
                  <p key={alt.id} className="text-xs">{getPlayerName(alt.id)} — {alt.why}</p>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* 3. Suggest Transfers */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 p-4">
          <ArrowLeftRight className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <CardTitle className="text-base">Suggest Transfers</CardTitle>
            <CardDescription>AI recommends optimal add/drop moves</CardDescription>
          </div>
          <Button size="sm" onClick={handleTransfers} disabled={transfersLoading}>
            {transfersLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Suggest"}
          </Button>
        </CardHeader>
        {transfersLoading && <CardContent><Skeleton className="h-24 w-full" /></CardContent>}
        {transfersResult && (
          <CardContent className="space-y-3 text-sm">
            {transfersResult.moves.map((move: any, idx: number) => (
              <div key={idx} className="bg-muted rounded p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="default" className="bg-green-600">ADD {getPlayerName(move.add)}</Badge>
                  <Badge variant="destructive">DROP {getPlayerName(move.drop)}</Badge>
                  <Badge variant="outline" className="text-xs">{Math.round(move.confidence * 100)}%</Badge>
                </div>
                <ul className="list-disc pl-4 text-xs space-y-0.5">
                  {move.reason_bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}
                </ul>
                <div className="flex gap-2 text-xs">
                  <span>ΔFP5: {move.expected_delta.proj_fp5 >= 0 ? "+" : ""}{move.expected_delta.proj_fp5.toFixed(1)}</span>
                  <span>ΔStocks5: {move.expected_delta.proj_stocks5 >= 0 ? "+" : ""}{move.expected_delta.proj_stocks5.toFixed(1)}</span>
                  <span>ΔAST5: {move.expected_delta.proj_ast5 >= 0 ? "+" : ""}{move.expected_delta.proj_ast5.toFixed(1)}</span>
                </div>
                {move.risk_flags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">{move.risk_flags.map((f: string, i: number) => <Badge key={i} variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />{f}</Badge>)}</div>
                )}
                <div className="flex gap-2">
                  {!simResults[idx] ? (
                    <Button size="sm" variant="outline" onClick={() => handleSimulate(idx, move)} disabled={simulatingIdx === idx}>
                      {simulatingIdx === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simulate"}
                    </Button>
                  ) : (
                    <>
                      <span className={`text-xs ${simResults[idx].is_valid ? "text-green-600" : "text-destructive"}`}>
                        {simResults[idx].is_valid ? "Valid" : simResults[idx].errors?.join(", ")}
                      </span>
                      {simResults[idx].is_valid && (
                        <Button size="sm" className="bg-nba-yellow text-foreground hover:bg-nba-yellow/80" onClick={() => handleCommit(idx, move)} disabled={committingIdx === idx}>
                          {committingIdx === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : "Commit"}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {transfersResult.notes.length > 0 && (
              <p className="text-xs text-muted-foreground italic">{transfersResult.notes.join(" · ")}</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* 4. Injury Monitor */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 p-4">
          <Shield className="h-5 w-5 text-destructive" />
          <div className="flex-1">
            <CardTitle className="text-base">Scan Injuries</CardTitle>
            <CardDescription>Check roster players for injury/availability</CardDescription>
          </div>
          <Button size="sm" onClick={handleInjury} disabled={injuryLoading}>
            {injuryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Scan"}
          </Button>
        </CardHeader>
        {injuryLoading && <CardContent><Skeleton className="h-20 w-full" /></CardContent>}
        {injuryResult && (
          <CardContent className="space-y-2 text-sm">
            {injuryResult.items.map((item: any) => (
              <div key={item.player_id} className="bg-muted rounded p-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{getPlayerName(item.player_id)}</span>
                  <Badge variant={statusColor(item.status) as any}>{item.status}</Badge>
                  <Badge variant="outline" className="text-xs">{item.impact} impact</Badge>
                </div>
                {item.headline && <p className="text-xs">{item.headline}</p>}
                <div className="text-xs">
                  <span className="font-medium">Action: </span>{item.recommended_move.action}
                </div>
                {item.recommended_move.replacement_targets.length > 0 && (
                  <div className="text-xs">
                    <span className="font-medium">Replacements: </span>
                    {item.recommended_move.replacement_targets.map((r: any) => (
                      <span key={r.player_id} className="mr-2">{getPlayerName(r.player_id)} ({Math.round(r.confidence * 100)}%)</span>
                    ))}
                  </div>
                )}
                {item.risk_flags.length > 0 && (
                  <div className="flex gap-1">{item.risk_flags.map((f: string, i: number) => <Badge key={i} variant="outline" className="text-xs">{f}</Badge>)}</div>
                )}
              </div>
            ))}
            {injuryResult.notes.length > 0 && (
              <p className="text-xs text-muted-foreground italic">{injuryResult.notes.join(" · ")}</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* 5. Explain Player */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 p-4">
          <HelpCircle className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <CardTitle className="text-base">Explain Player</CardTitle>
            <CardDescription>AI breakdown of any player's value</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search player name..."
              value={explainSearch}
              onChange={(e) => setExplainSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleExplain()}
              className="flex-1"
            />
            <Button size="sm" onClick={handleExplain} disabled={explainLoading}>
              {explainLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask AI"}
            </Button>
          </div>
          {explainLoading && <Skeleton className="h-20 w-full" />}
          {explainResult && (
            <div className="space-y-2 text-sm">
              <p className="font-medium">{explainResult.summary}</p>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Scoring Factors</p>
                {explainResult.why_it_scores.map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">{f.factor}</Badge>
                    <Badge variant={f.impact === "very_high" || f.impact === "high" ? "default" : "secondary"}>{f.impact}</Badge>
                    <span>{f.note}</span>
                  </div>
                ))}
              </div>
              {explainResult.trend_flags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Trends</p>
                  {explainResult.trend_flags.map((t: any, i: number) => (
                    <div key={i} className="text-xs flex gap-1 items-center">
                      <Badge variant="outline">{t.type}</Badge>
                      <span>{t.detail}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Badge variant={explainResult.recommendation.action === "add" ? "default" : explainResult.recommendation.action === "drop" ? "destructive" : "secondary"}>
                  {explainResult.recommendation.action.toUpperCase()}
                </Badge>
                <span className="text-xs">{explainResult.recommendation.rationale}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
