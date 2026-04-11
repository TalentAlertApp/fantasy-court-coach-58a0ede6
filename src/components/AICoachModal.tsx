import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Activity, Star, ArrowLeftRight, Shield, HelpCircle, Loader2, AlertTriangle } from "lucide-react";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useTeam } from "@/contexts/TeamContext";
import {
  aiAnalyzeRoster, aiPickCaptain, aiSuggestTransfers, aiInjuryMonitor, aiExplainPlayer,
  saveRoster, simulateTransactions, commitTransaction,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface AICoachModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AICoachModal({ open, onOpenChange }: AICoachModalProps) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-sm max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <Bot className="h-5 w-5 text-accent" />
            AI COACH
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="analyze" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="rounded-sm shrink-0 grid grid-cols-5">
            <TabsTrigger value="analyze" className="font-heading text-[10px] uppercase rounded-sm"><Activity className="h-3 w-3 mr-1" />Analyze</TabsTrigger>
            <TabsTrigger value="captain" className="font-heading text-[10px] uppercase rounded-sm"><Star className="h-3 w-3 mr-1" />Captain</TabsTrigger>
            <TabsTrigger value="transfers" className="font-heading text-[10px] uppercase rounded-sm"><ArrowLeftRight className="h-3 w-3 mr-1" />Transfers</TabsTrigger>
            <TabsTrigger value="injuries" className="font-heading text-[10px] uppercase rounded-sm"><Shield className="h-3 w-3 mr-1" />Injuries</TabsTrigger>
            <TabsTrigger value="explain" className="font-heading text-[10px] uppercase rounded-sm"><HelpCircle className="h-3 w-3 mr-1" />Explain</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto mt-3 space-y-3">
            {/* Analyze */}
            <TabsContent value="analyze" className="mt-0 space-y-3">
              <Button size="sm" onClick={handleAnalyze} disabled={analyzeLoading} className="w-full">
                {analyzeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Activity className="h-4 w-4 mr-2" />}
                Analyze My Roster
              </Button>
              {analyzeLoading && <Skeleton className="h-20 w-full" />}
              {analyzeResult && (
                <div className="space-y-3 text-sm">
                  <ul className="list-disc pl-4 space-y-0.5 text-xs">{analyzeResult.summary_bullets?.map((b: string, i: number) => <li key={i}>{b}</li>)}</ul>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-heading font-bold uppercase text-green-600 mb-1">Strengths</p>
                      <ul className="list-disc pl-4 space-y-0.5 text-xs">{analyzeResult.strengths?.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                    </div>
                    <div>
                      <p className="text-[10px] font-heading font-bold uppercase text-destructive mb-1">Weaknesses</p>
                      <ul className="list-disc pl-4 space-y-0.5 text-xs">{analyzeResult.weaknesses?.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Captain */}
            <TabsContent value="captain" className="mt-0 space-y-3">
              <Button size="sm" onClick={handleCaptain} disabled={captainLoading} className="w-full">
                {captainLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Star className="h-4 w-4 mr-2" />}
                Best Captain Today
              </Button>
              {captainLoading && <Skeleton className="h-20 w-full" />}
              {captainResult && (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-3">
                    <p className="font-heading font-bold uppercase">Captain: {getPlayerName(captainResult.captain_id)}</p>
                    <Badge variant="outline" className="text-[9px] rounded-sm">{Math.round(captainResult.confidence * 100)}%</Badge>
                    <Button size="sm" className="ml-auto" onClick={handleApplyCaptain} disabled={applyingCaptain}>
                      {applyingCaptain ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                  <ul className="list-disc pl-4 text-xs space-y-0.5">{captainResult.reason_bullets?.map((b: string, i: number) => <li key={i}>{b}</li>)}</ul>
                </div>
              )}
            </TabsContent>

            {/* Transfers */}
            <TabsContent value="transfers" className="mt-0 space-y-3">
              <Button size="sm" onClick={handleTransfers} disabled={transfersLoading} className="w-full">
                {transfersLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowLeftRight className="h-4 w-4 mr-2" />}
                Suggest Transfers
              </Button>
              {transfersLoading && <Skeleton className="h-20 w-full" />}
              {transfersResult?.moves?.map((move: any, idx: number) => (
                <div key={idx} className="bg-muted rounded-sm p-3 space-y-2 border">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-green-600 text-white rounded-sm text-[9px]">ADD {getPlayerName(move.add)}</Badge>
                    <Badge variant="destructive" className="rounded-sm text-[9px]">DROP {getPlayerName(move.drop)}</Badge>
                    <Badge variant="outline" className="text-[9px] rounded-sm">{Math.round(move.confidence * 100)}%</Badge>
                  </div>
                  <ul className="list-disc pl-4 text-[10px] space-y-0.5">{move.reason_bullets?.map((b: string, i: number) => <li key={i}>{b}</li>)}</ul>
                  {move.risk_flags?.length > 0 && (
                    <div className="flex gap-1 flex-wrap">{move.risk_flags.map((f: string, i: number) => <Badge key={i} variant="destructive" className="text-[9px] rounded-sm"><AlertTriangle className="h-3 w-3 mr-0.5" />{f}</Badge>)}</div>
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
            </TabsContent>

            {/* Injuries */}
            <TabsContent value="injuries" className="mt-0 space-y-3">
              <Button size="sm" onClick={handleInjury} disabled={injuryLoading} className="w-full">
                {injuryLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                Scan Injuries
              </Button>
              {injuryLoading && <Skeleton className="h-20 w-full" />}
              {injuryResult?.items?.map((item: any) => (
                <div key={item.player_id} className="bg-muted rounded-sm p-2 space-y-1 border">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold uppercase text-xs">{getPlayerName(item.player_id)}</span>
                    <Badge variant={statusColor(item.status) as any} className="rounded-sm text-[9px]">{item.status}</Badge>
                    <Badge variant="outline" className="text-[9px] rounded-sm">{item.impact} impact</Badge>
                  </div>
                  {item.headline && <p className="text-[10px]">{item.headline}</p>}
                  <div className="text-[10px]"><span className="font-semibold">Action: </span>{item.recommended_move?.action}</div>
                </div>
              ))}
            </TabsContent>

            {/* Explain */}
            <TabsContent value="explain" className="mt-0 space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Search player name..." value={explainSearch} onChange={(e) => setExplainSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleExplain()} className="rounded-sm flex-1" />
                <Button size="sm" onClick={handleExplain} disabled={explainLoading}>
                  {explainLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Explain"}
                </Button>
              </div>
              {explainLoading && <Skeleton className="h-20 w-full" />}
              {explainResult && (
                <div className="space-y-2 text-sm">
                  <p className="font-semibold">{explainResult.summary}</p>
                  {explainResult.why_it_scores?.map((f: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs mb-1">
                      <Badge variant="outline" className="rounded-sm text-[9px]">{f.factor}</Badge>
                      <Badge variant={f.impact === "very_high" || f.impact === "high" ? "default" : "secondary"} className="rounded-sm text-[9px]">{f.impact}</Badge>
                      <span>{f.note}</span>
                    </div>
                  ))}
                  {explainResult.recommendation && (
                    <div className="flex items-center gap-2">
                      <Badge variant={explainResult.recommendation.action === "add" ? "default" : explainResult.recommendation.action === "drop" ? "destructive" : "secondary"} className="rounded-sm">
                        {explainResult.recommendation.action.toUpperCase()}
                      </Badge>
                      <span className="text-xs">{explainResult.recommendation.rationale}</span>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
