import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Bot, ArrowLeftRight, Star, HelpCircle, Activity, Shield, Loader2, AlertTriangle } from "lucide-react";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useTeam } from "@/contexts/TeamContext";
import {
  aiAnalyzeRoster, aiPickCaptain, aiSuggestTransfers, aiInjuryMonitor, aiExplainPlayer,
  saveRoster, simulateTransactions, commitTransaction,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function AIHubPage() {
  const { toast } = useToast();
  const { selectedTeamId, teams } = useTeam();
  const { data: rosterData } = useRosterQuery();
  const { data: playersData } = usePlayersQuery();

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
  const teamName = teams.find((t: any) => t.id === selectedTeamId)?.name ?? "My Team";

  const getPlayerName = (id: number) => {
    const p = playersData?.items?.find((i: any) => i.core.id === id);
    return p?.core?.name ?? `#${id}`;
  };

  const handleAnalyze = async () => {
    setAnalyzeLoading(true); setAnalyzeResult(null);
    try { setAnalyzeResult(await aiAnalyzeRoster({ gw, day, focus: "balanced" }, selectedTeamId ?? undefined)); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setAnalyzeLoading(false); }
  };

  const handleCaptain = async () => {
    setCaptainLoading(true); setCaptainResult(null);
    try { setCaptainResult(await aiPickCaptain({ gw, day }, selectedTeamId ?? undefined)); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setCaptainLoading(false); }
  };

  const handleApplyCaptain = async () => {
    if (!captainResult || !rosterData) return;
    setApplyingCaptain(true);
    try {
      await saveRoster({ gw, day, starters: rosterData.roster.starters, bench: rosterData.roster.bench, captain_id: captainResult.captain_id }, selectedTeamId ?? undefined);
      toast({ title: "Captain applied!" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setApplyingCaptain(false); }
  };

  const handleTransfers = async () => {
    setTransfersLoading(true); setTransfersResult(null); setSimResults({});
    try { setTransfersResult(await aiSuggestTransfers({ gw, day, max_cost: rosterData?.roster?.bank_remaining ?? 100, objective: "maximize_fp5" }, selectedTeamId ?? undefined)); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setTransfersLoading(false); }
  };

  const handleSimulate = async (idx: number, move: any) => {
    setSimulatingIdx(idx);
    try { const res = await simulateTransactions({ gw, day, adds: [move.add], drops: [move.drop] }, selectedTeamId ?? undefined); setSimResults((prev) => ({ ...prev, [idx]: res })); }
    catch (e: any) { toast({ title: "Sim Error", description: e.message, variant: "destructive" }); }
    finally { setSimulatingIdx(null); }
  };

  const handleCommit = async (idx: number, move: any) => {
    setCommittingIdx(idx);
    try { await commitTransaction({ gw, day, adds: [move.add], drops: [move.drop] }, selectedTeamId ?? undefined); toast({ title: "Transfer committed!" }); }
    catch (e: any) { toast({ title: "Commit Error", description: e.message, variant: "destructive" }); }
    finally { setCommittingIdx(null); }
  };

  const handleInjury = async () => {
    setInjuryLoading(true); setInjuryResult(null);
    try {
      const rosterPlayerIds = rosterData?.roster ? [...rosterData.roster.starters, ...rosterData.roster.bench] : [];
      setInjuryResult(await aiInjuryMonitor({ player_ids: rosterPlayerIds, include_replacements: true, max_salary: rosterData?.roster?.bank_remaining ?? null }, selectedTeamId ?? undefined));
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setInjuryLoading(false); }
  };

  const handleExplain = async () => {
    if (!explainSearch.trim()) return;
    const player = playersData?.items?.find((i: any) => i.core.name.toLowerCase().includes(explainSearch.toLowerCase()));
    if (!player) { toast({ title: "Player not found", variant: "destructive" }); return; }
    setExplainLoading(true); setExplainResult(null);
    try { setExplainResult(await aiExplainPlayer({ player_id: player.core.id }, selectedTeamId ?? undefined)); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setExplainLoading(false); }
  };

  const statusColor = (s: string) => {
    switch (s) { case "OUT": return "destructive"; case "Q": return "secondary"; case "DTD": return "outline"; default: return "default"; }
  };

  const sectionCard = (icon: React.ReactNode, title: string, desc: string, btnLabel: string, onAction: () => void, loading: boolean, children?: React.ReactNode) => (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/50">
        {icon}
        <div className="flex-1">
          <p className="text-sm font-heading font-bold uppercase">{title}</p>
          <p className="text-[10px] text-muted-foreground">{desc}</p>
        </div>
        <Button size="sm" onClick={onAction} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : btnLabel}
        </Button>
      </div>
      {loading && <div className="p-4"><Skeleton className="h-20 w-full" /></div>}
      {children && <div className="p-4 space-y-3 text-sm">{children}</div>}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-8">
      {/* Dark navy header */}
      <div className="bg-nba-navy text-white rounded-lg px-4 py-3 flex items-center gap-3">
        <Bot className="h-8 w-8 text-accent" />
        <div>
          <h2 className="text-lg font-heading font-bold tracking-wider">{teamName} — AI COACH</h2>
          <p className="text-[10px] text-white/60">Powered by GPT-4.1 Mini with real-time NBA search</p>
        </div>
      </div>

      {/* 1. Analyze */}
      {sectionCard(
        <Activity className="h-5 w-5 text-primary" />, "Analyze My Roster", "Get strengths, weaknesses, and quick wins", "Analyze", handleAnalyze, analyzeLoading,
        analyzeResult && (
          <>
            <div>
              <p className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-1">Summary</p>
              <ul className="list-disc pl-4 space-y-0.5 text-xs">{analyzeResult.summary_bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}</ul>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-heading font-bold uppercase text-green-600 mb-1">Strengths</p>
                <ul className="list-disc pl-4 space-y-0.5 text-xs">{analyzeResult.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
              </div>
              <div>
                <p className="text-[10px] font-heading font-bold uppercase text-destructive mb-1">Weaknesses</p>
                <ul className="list-disc pl-4 space-y-0.5 text-xs">{analyzeResult.weaknesses.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>
              </div>
            </div>
            {analyzeResult.quick_wins?.length > 0 && (
              <div>
                <p className="text-[10px] font-heading font-bold uppercase text-muted-foreground mb-1">Quick Wins</p>
                {analyzeResult.quick_wins.map((qw: any, i: number) => (
                  <div key={i} className="bg-muted rounded-lg p-2 mb-1 border">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs">{qw.title}</span>
                      <Badge variant="outline" className="text-[9px] rounded-lg">{Math.round(qw.confidence * 100)}%</Badge>
                    </div>
                    <ul className="list-disc pl-4 text-[10px] mt-1">{qw.why.map((w: string, j: number) => <li key={j}>{w}</li>)}</ul>
                    {qw.risk_flags?.length > 0 && (
                      <div className="flex gap-1 mt-1">{qw.risk_flags.map((f: string, j: number) => <Badge key={j} variant="destructive" className="text-[9px] rounded-lg">{f}</Badge>)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {analyzeResult.recommended_actions?.length > 0 && (
              <div>{analyzeResult.recommended_actions.map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs"><Badge className="rounded-lg text-[9px]">{a.type}</Badge><span>{a.note}</span></div>
              ))}</div>
            )}
            {analyzeResult.notes?.length > 0 && <p className="text-[10px] text-muted-foreground italic">{analyzeResult.notes.join(" · ")}</p>}
          </>
        )
      )}

      {/* 2. Captain */}
      {sectionCard(
        <Star className="h-5 w-5 text-accent" />, "Best Captain Today", "AI recommends your optimal captain", "Pick", handleCaptain, captainLoading,
        captainResult && (
          <>
            <div className="flex items-center gap-3">
              <div>
                <p className="font-heading font-bold uppercase text-sm">Captain: {getPlayerName(captainResult.captain_id)}</p>
                <Badge variant="outline" className="text-[9px] rounded-lg">{Math.round(captainResult.confidence * 100)}% confidence</Badge>
              </div>
              <Button size="sm" className="ml-auto" onClick={handleApplyCaptain} disabled={applyingCaptain}>
                {applyingCaptain ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply Captain"}
              </Button>
            </div>
            <ul className="list-disc pl-4 text-xs space-y-0.5">{captainResult.reason_bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}</ul>
            {captainResult.alternatives?.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground font-heading uppercase font-bold">Alternatives:</p>
                {captainResult.alternatives.map((alt: any) => <p key={alt.id} className="text-xs">{getPlayerName(alt.id)} — {alt.why}</p>)}
              </div>
            )}
          </>
        )
      )}

      {/* 3. Transfers */}
      {sectionCard(
        <ArrowLeftRight className="h-5 w-5 text-primary" />, "Suggest Transfers", "AI recommends optimal add/drop moves", "Suggest", handleTransfers, transfersLoading,
        transfersResult && (
          <>
            {transfersResult.moves.map((move: any, idx: number) => (
              <div key={idx} className="bg-muted rounded-lg p-3 space-y-2 border">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-green-600 text-white rounded-lg text-[9px]">ADD {getPlayerName(move.add)}</Badge>
                  <Badge variant="destructive" className="rounded-lg text-[9px]">DROP {getPlayerName(move.drop)}</Badge>
                  <Badge variant="outline" className="text-[9px] rounded-lg">{Math.round(move.confidence * 100)}%</Badge>
                </div>
                <ul className="list-disc pl-4 text-[10px] space-y-0.5">{move.reason_bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}</ul>
                <div className="flex gap-2 text-[10px] font-mono">
                  <span>ΔFP5: {move.expected_delta.proj_fp5 >= 0 ? "+" : ""}{move.expected_delta.proj_fp5.toFixed(1)}</span>
                  <span>ΔStocks5: {move.expected_delta.proj_stocks5 >= 0 ? "+" : ""}{move.expected_delta.proj_stocks5.toFixed(1)}</span>
                </div>
                {move.risk_flags?.length > 0 && (
                  <div className="flex gap-1 flex-wrap">{move.risk_flags.map((f: string, i: number) => <Badge key={i} variant="destructive" className="text-[9px] rounded-lg"><AlertTriangle className="h-3 w-3 mr-0.5" />{f}</Badge>)}</div>
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
                        <Button size="sm" onClick={() => handleCommit(idx, move)} disabled={committingIdx === idx}>
                          {committingIdx === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : "Commit"}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {transfersResult.notes?.length > 0 && <p className="text-[10px] text-muted-foreground italic">{transfersResult.notes.join(" · ")}</p>}
          </>
        )
      )}

      {/* 4. Injury */}
      {sectionCard(
        <Shield className="h-5 w-5 text-destructive" />, "Scan Injuries", "Check roster players for injury/availability", "Scan", handleInjury, injuryLoading,
        injuryResult && (
          <>
            {injuryResult.items.map((item: any) => (
              <div key={item.player_id} className="bg-muted rounded-lg p-2 space-y-1 border">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold uppercase text-xs">{getPlayerName(item.player_id)}</span>
                  <Badge variant={statusColor(item.status) as any} className="rounded-lg text-[9px]">{item.status}</Badge>
                  <Badge variant="outline" className="text-[9px] rounded-lg">{item.impact} impact</Badge>
                </div>
                {item.headline && <p className="text-[10px]">{item.headline}</p>}
                <div className="text-[10px]"><span className="font-semibold">Action: </span>{item.recommended_move.action}</div>
                {item.recommended_move.replacement_targets?.length > 0 && (
                  <div className="text-[10px]">
                    <span className="font-semibold">Replacements: </span>
                    {item.recommended_move.replacement_targets.map((r: any) => `${getPlayerName(r.player_id)} (${Math.round(r.confidence * 100)}%)`).join(", ")}
                  </div>
                )}
              </div>
            ))}
            {injuryResult.notes?.length > 0 && <p className="text-[10px] text-muted-foreground italic">{injuryResult.notes.join(" · ")}</p>}
          </>
        )
      )}

      {/* 5. Explain Player */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/50">
          <HelpCircle className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-heading font-bold uppercase">Explain Player</p>
            <p className="text-[10px] text-muted-foreground">Deep AI analysis of any player</p>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Search player name..." value={explainSearch} onChange={(e) => setExplainSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleExplain()} className="rounded-lg flex-1" />
            <Button size="sm" onClick={handleExplain} disabled={explainLoading}>
              {explainLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Explain"}
            </Button>
          </div>
          {explainLoading && <Skeleton className="h-20 w-full" />}
          {explainResult && (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">{explainResult.summary}</p>
              <div>
                <p className="text-[10px] font-heading font-bold text-muted-foreground uppercase mb-1">Scoring Factors</p>
                {explainResult.why_it_scores.map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs mb-1">
                    <Badge variant="outline" className="rounded-lg text-[9px]">{f.factor}</Badge>
                    <Badge variant={f.impact === "very_high" || f.impact === "high" ? "default" : "secondary"} className="rounded-lg text-[9px]">{f.impact}</Badge>
                    <span>{f.note}</span>
                  </div>
                ))}
              </div>
              {explainResult.trend_flags?.length > 0 && (
                <div>
                  <p className="text-[10px] font-heading font-bold text-muted-foreground uppercase mb-1">Trends</p>
                  {explainResult.trend_flags.map((t: any, i: number) => (
                    <div key={i} className="text-xs flex gap-1 items-center mb-1">
                      <Badge variant="outline" className="rounded-lg text-[9px]">{t.type}</Badge>
                      <span>{t.detail}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Badge variant={explainResult.recommendation.action === "add" ? "default" : explainResult.recommendation.action === "drop" ? "destructive" : "secondary"} className="rounded-lg">
                  {explainResult.recommendation.action.toUpperCase()}
                </Badge>
                <span className="text-xs">{explainResult.recommendation.rationale}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
