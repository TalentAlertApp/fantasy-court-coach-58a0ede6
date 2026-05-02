import { useState, useMemo, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Bot, Activity, Star, ArrowLeftRight, Shield, HelpCircle, Loader2, AlertTriangle, Disc, Users, Clock, Sparkles, Quote } from "lucide-react";
import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useTeam } from "@/contexts/TeamContext";
import { getTeamLogo, NBA_TEAMS } from "@/lib/nba-teams";
import {
  aiAnalyzeRoster, aiPickCaptain, aiSuggestTransfers, aiInjuryMonitor, aiExplainPlayer,
  saveRoster, simulateTransactions, commitTransaction, autoPickRoster,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import InjuryReportModal from "@/components/InjuryReportModal";
import { getCurrentGameday } from "@/lib/deadlines";
import { useQueryClient } from "@tanstack/react-query";

interface AICoachModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Strip diacritics for search matching */
function normalize(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function getTeamFullName(tricode: string): string {
  const t = NBA_TEAMS.find((t) => t.tricode === tricode);
  return t?.name ?? tricode;
}

export default function AICoachModal({ open, onOpenChange }: AICoachModalProps) {
  const { toast } = useToast();
  const { selectedTeamId, teams } = useTeam();
  const { data: rosterData } = useRosterQuery();
  const { data: playersData } = usePlayersQuery({ limit: 1000 });
  const queryClient = useQueryClient();

  const [analyzeResult, setAnalyzeResult] = useState<any>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [captainResult, setCaptainResult] = useState<any>(null);
  const [captainLoading, setCaptainLoading] = useState(false);
  const [transfersResult, setTransfersResult] = useState<any>(null);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [injuryModalOpen, setInjuryModalOpen] = useState(false);
  const [explainResult, setExplainResult] = useState<any>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainSearch, setExplainSearch] = useState("");
  const [selectedExplainPlayer, setSelectedExplainPlayer] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentExplained, setRecentExplained] = useState<Array<{ id: number; name: string; team: string; photo: string | null; fc_bc: string }>>(() => {
    try {
      const raw = localStorage.getItem("nbaf:ai-explain-recent");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [applyingCaptain, setApplyingCaptain] = useState(false);
  const [simulatingIdx, setSimulatingIdx] = useState<number | null>(null);
  const [committingIdx, setCommittingIdx] = useState<number | null>(null);
  const [simResults, setSimResults] = useState<Record<number, any>>({});
  const [draftingFromEmpty, setDraftingFromEmpty] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const gw = rosterData?.roster?.gw ?? 1;
  const day = rosterData?.roster?.day ?? 1;
  const allPlayers = playersData?.items ?? [];

  // True when the active team has zero real players on its roster.
  const isRosterEmpty = useMemo(() => {
    const starters = rosterData?.roster?.starters ?? [];
    const bench = rosterData?.roster?.bench ?? [];
    return [...starters, ...bench].every((id: number) => !id || id === 0);
  }, [rosterData]);

  const handleDraftFromEmpty = async () => {
    if (!selectedTeamId) return;
    setDraftingFromEmpty(true);
    try {
      const { gw: cgw, day: cday } = getCurrentGameday();
      await autoPickRoster({ gw: cgw, day: cday, strategy: "value5" }, selectedTeamId);
      // Pick captain on the freshly drafted roster (best-effort).
      try {
        const cap = await aiPickCaptain({ gw: cgw, day: cday }, selectedTeamId);
        await queryClient.invalidateQueries({ queryKey: ["roster-current", selectedTeamId] });
        // Re-fetch roster so we can save with the AI-picked captain.
        const fresh = await (await import("@/lib/api")).fetchRosterCurrent(selectedTeamId);
        if (fresh?.roster && cap?.captain_id) {
          await saveRoster({
            gw: cgw, day: cday,
            starters: fresh.roster.starters,
            bench: fresh.roster.bench,
            captain_id: cap.captain_id,
          }, selectedTeamId);
        }
      } catch (capErr) {
        // Captain step is non-fatal — roster is already drafted.
        console.warn("AI captain pick skipped:", capErr);
      }
      await queryClient.invalidateQueries({ queryKey: ["roster-current", selectedTeamId] });
      toast({ title: "Squad drafted with AI!", description: `Saved under GW${cgw} · Day ${cday}.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "AI draft failed", description: e?.message ?? "Try again.", variant: "destructive" });
    } finally {
      setDraftingFromEmpty(false);
    }
  };

  const getPlayerName = (id: number) => {
    const p = allPlayers.find((i: any) => i.core.id === id);
    return p?.core?.name ?? `#${id}`;
  };

  // Autocomplete matches for explain tab
  const explainMatches = useMemo(() => {
    if (explainSearch.length < 1 || selectedExplainPlayer) return [];
    const q = normalize(explainSearch);
    return allPlayers.filter((p) => {
      const nameNorm = normalize(p.core.name);
      const teamNorm = normalize(p.core.team);
      const teamFull = normalize(getTeamFullName(p.core.team));
      return nameNorm.includes(q) || teamNorm.includes(q) || teamFull.includes(q);
    }).slice(0, 8);
  }, [explainSearch, allPlayers, selectedExplainPlayer]);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setShowDropdown(explainMatches.length > 0);
  }, [explainMatches]);

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
    try { await commitTransaction({ gw, day, ins: [move.add], outs: [move.drop] }, selectedTeamId ?? undefined); toast({ title: "Transfer committed!" }); }
    catch (e: any) { toast({ title: "Commit Error", description: e.message, variant: "destructive" }); }
    finally { setCommittingIdx(null); }
  };

  // Injury monitoring is now delegated to the standalone <InjuryReportModal />.

  const handleExplain = async () => {
    let target = selectedExplainPlayer;
    if (!target && explainMatches.length > 0) {
      target = explainMatches[0];
      setSelectedExplainPlayer(target);
      setExplainSearch(target.core.name);
      setShowDropdown(false);
    }
    if (!target) {
      toast({ title: "Type a player name to search", variant: "destructive" });
      return;
    }
    setExplainLoading(true); setExplainResult(null);
    try {
      const res = await aiExplainPlayer({ player_id: target.core.id }, selectedTeamId ?? undefined);
      setExplainResult(res);
      const entry = { id: target.core.id, name: target.core.name, team: target.core.team, photo: target.core.photo ?? null, fc_bc: target.core.fc_bc };
      setRecentExplained((prev) => {
        const next = [entry, ...prev.filter((p) => p.id !== entry.id)].slice(0, 5);
        try { localStorage.setItem("nbaf:ai-explain-recent", JSON.stringify(next)); } catch {}
        return next;
      });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setExplainLoading(false); }
  };

  const handleExplainSearchChange = (val: string) => {
    setExplainSearch(val);
    setSelectedExplainPlayer(null);
    setExplainResult(null);
    setShowDropdown(true);
  };

  const handleRecentClick = async (r: { id: number; name: string }) => {
    const found = allPlayers.find((p: any) => p.core.id === r.id);
    if (!found) {
      toast({ title: "Player not loaded yet", description: "Try again in a moment.", variant: "destructive" });
      return;
    }
    setSelectedExplainPlayer(found);
    setExplainSearch(found.core.name);
    setShowDropdown(false);
    setExplainLoading(true); setExplainResult(null);
    try {
      const res = await aiExplainPlayer({ player_id: found.core.id }, selectedTeamId ?? undefined);
      setExplainResult(res);
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setExplainLoading(false); }
  };

  const handleSelectExplainPlayer = (p: any) => {
    setExplainSearch(p.core.name);
    setSelectedExplainPlayer(p);
    setShowDropdown(false);
  };

  const statusColor = (s: string) => {
    switch (s) { case "OUT": return "destructive"; case "Q": return "secondary"; case "DTD": return "outline"; default: return "default"; }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-lg max-h-[92vh] h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <BallersIQBrand variant="wordmark" size="sm" />
            <span className="sr-only">Ballers.IQ</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="analyze" className="flex-1 min-h-0 flex flex-col">
          {isRosterEmpty && (
            <div className="shrink-0 mb-3 rounded-xl border-2 border-accent/40 bg-accent/5 p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading uppercase tracking-wider text-sm font-bold">No roster yet</p>
                <p className="text-xs text-muted-foreground">Let me build a balanced 10-player squad and pick your captain.</p>
              </div>
              <Button
                size="sm"
                onClick={handleDraftFromEmpty}
                disabled={draftingFromEmpty}
                className="rounded-lg font-heading uppercase text-xs shrink-0"
              >
                {draftingFromEmpty ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Bot className="h-4 w-4 mr-1" />}
                Draft my squad with AI
              </Button>
            </div>
          )}
          <TabsList className="rounded-lg shrink-0 grid grid-cols-5">
            <TabsTrigger value="analyze" className="font-heading text-[10px] uppercase rounded-lg"><Activity className="h-3 w-3 mr-1" />Analyze</TabsTrigger>
            <TabsTrigger value="captain" className="font-heading text-[10px] uppercase rounded-lg"><Star className="h-3 w-3 mr-1" />Captain</TabsTrigger>
            <TabsTrigger value="transfers" className="font-heading text-[10px] uppercase rounded-lg"><ArrowLeftRight className="h-3 w-3 mr-1" />Transfers</TabsTrigger>
            <TabsTrigger value="injuries" className="font-heading text-[10px] uppercase rounded-lg"><Shield className="h-3 w-3 mr-1" />Injuries</TabsTrigger>
            <TabsTrigger value="explain" className="font-heading text-[10px] uppercase rounded-lg"><HelpCircle className="h-3 w-3 mr-1" />Explain</TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto mt-3 space-y-2.5">
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
                    <Badge variant="outline" className="text-[9px] rounded-lg">{Math.round(captainResult.confidence * 100)}%</Badge>
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
                <div key={idx} className="bg-muted rounded-lg p-3 space-y-2 border">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-green-600 text-white rounded-lg text-[9px]">ADD {getPlayerName(move.add)}</Badge>
                    <Badge variant="destructive" className="rounded-lg text-[9px]">DROP {getPlayerName(move.drop)}</Badge>
                    <Badge variant="outline" className="text-[9px] rounded-lg">{Math.round(move.confidence * 100)}%</Badge>
                  </div>
                  <ul className="list-disc pl-4 text-[10px] space-y-0.5">{move.reason_bullets?.map((b: string, i: number) => <li key={i}>{b}</li>)}</ul>
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
            </TabsContent>

            {/* Injuries */}
            <TabsContent value="injuries" className="mt-0 space-y-3">
              <Button
                size="sm"
                onClick={() => setInjuryModalOpen(true)}
                className="w-full bg-yellow-500 hover:bg-yellow-500/90 text-black"
              >
                <Shield className="h-4 w-4 mr-2" />
                Scan Injuries
              </Button>
              <p className="text-[10px] text-muted-foreground text-center">
                Opens the league-wide injury report aggregated from ESPN, CBS Sports and RotoWire.
              </p>
            </TabsContent>

            {/* Explain */}
            <TabsContent value="explain" className="mt-0 space-y-3">
              {/* Recent 5 explained chips */}
              {!explainSearch && !explainResult && recentExplained.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-heading uppercase tracking-wider text-muted-foreground">Recent</span>
                  {recentExplained.map((r) => {
                    const logo = getTeamLogo(r.team);
                    const lastName = r.name.split(/\s+/).slice(-1)[0];
                    return (
                      <button
                        key={r.id}
                        onClick={() => handleRecentClick(r)}
                        className="inline-flex items-center gap-1.5 bg-muted hover:bg-accent/50 transition-colors rounded-full pl-0.5 pr-2 py-0.5 border"
                        title={r.name}
                      >
                        {r.photo ? (
                          <img src={r.photo} alt="" className="w-5 h-5 rounded-full object-cover bg-card" />
                        ) : logo ? (
                          <img src={logo} alt="" className="w-5 h-5 rounded-full object-contain bg-card" />
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-card text-[8px] font-bold inline-flex items-center justify-center">{r.name.slice(0,1)}</span>
                        )}
                        <span className="text-[10px] font-heading font-semibold">{lastName}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <Popover open={showDropdown && explainMatches.length > 0} onOpenChange={setShowDropdown}>
                <div className="flex gap-2">
                  <PopoverAnchor asChild>
                    <Input
                      placeholder="Search player name or team..."
                      value={explainSearch}
                      onChange={(e) => handleExplainSearchChange(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleExplain()}
                      className="rounded-lg flex-1"
                    />
                  </PopoverAnchor>
                  <Button size="sm" onClick={handleExplain} disabled={explainLoading || (!selectedExplainPlayer && explainMatches.length === 0)}>
                    {explainLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Explain"}
                  </Button>
                </div>

                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={4}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  className="p-0 rounded-xl w-[var(--radix-popover-trigger-width)] max-h-[260px] overflow-y-auto z-[100]"
                >
                  {explainMatches.map((p) => {
                      const logo = getTeamLogo(p.core.team);
                      const teamFullName = getTeamFullName(p.core.team);
                      return (
                        <button
                          key={p.core.id}
                          onClick={() => handleSelectExplainPlayer(p)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors text-left group relative overflow-hidden"
                        >
                          {/* Team watermark */}
                          {logo && (
                            <img
                              src={logo}
                              alt=""
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 opacity-[0.08] pointer-events-none group-hover:opacity-[0.2] group-hover:scale-125 transition-all"
                            />
                          )}
                          {p.core.photo ? (
                            <img src={p.core.photo} alt="" className="w-8 h-8 rounded-full object-cover bg-muted shrink-0 transition-transform group-hover:scale-110 relative z-10" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0 relative z-10">
                              {p.core.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0 relative z-10">
                            <p className="text-sm font-heading font-semibold truncate">{p.core.name}</p>
                            <div className="flex items-center gap-1.5">
                              {logo && (
                                <img src={logo} alt="" className="w-4 h-4 object-contain shrink-0" />
                              )}
                              <span className="text-[10px] text-muted-foreground">{teamFullName}</span>
                              <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-1 py-0 rounded-lg h-3.5">
                                {p.core.fc_bc}
                              </Badge>
                            </div>
                          </div>
                          <div className="relative z-10 shrink-0 ml-2 text-right">
                            <span className="font-mono text-[11px] font-bold text-foreground">{Number((p as any).last5?.fp5 ?? 0).toFixed(1)}</span>
                            <span className="text-[8px] text-muted-foreground ml-0.5">FP5</span>
                          </div>
                        </button>
                      );
                    })}
                </PopoverContent>
              </Popover>

              {explainLoading && (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              )}
              {!explainLoading && explainResult && (
                <ExplainReport result={explainResult} player={selectedExplainPlayer} />
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
    <InjuryReportModal open={injuryModalOpen} onOpenChange={setInjuryModalOpen} />
    </>
  );
}

/* ---------- Explain Report (premium UI) ---------- */

function factorIcon(factor: string) {
  const f = (factor || "").toLowerCase();
  if (f.includes("reb")) return Disc;
  if (f.includes("ast") || f.includes("assist")) return Users;
  if (f.includes("block") || f.includes("stocks") || f.includes("steal") || f.includes("def")) return Shield;
  if (f.includes("min")) return Clock;
  if (f.includes("usage") || f.includes("score") || f.includes("pts") || f.includes("scoring")) return Activity;
  return Sparkles;
}

function impactClasses(impact: string): string {
  switch ((impact || "").toLowerCase()) {
    case "very_high":
      return "bg-emerald-500 text-white border border-emerald-500";
    case "high":
      return "bg-emerald-500/15 text-emerald-500 border border-emerald-500/40";
    case "medium":
      return "bg-amber-500/15 text-amber-500 border border-amber-500/40";
    default:
      return "bg-muted text-muted-foreground border border-border";
  }
}

function actionPalette(action: string): { chip: string; band: string; label: string } {
  switch ((action || "").toLowerCase()) {
    case "add":
      return {
        chip: "bg-emerald-500 text-white",
        band: "bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/40",
        label: "ADD",
      };
    case "drop":
      return {
        chip: "bg-destructive text-destructive-foreground",
        band: "bg-gradient-to-r from-destructive/15 via-destructive/5 to-transparent border-destructive/40",
        label: "DROP",
      };
    default:
      return {
        chip: "bg-amber-500 text-white",
        band: "bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/40",
        label: (action || "HOLD").toUpperCase(),
      };
  }
}

function ExplainReport({ result, player }: { result: any; player: any }) {
  const teamTricode = player?.core?.team;
  const teamLogo = teamTricode ? getTeamLogo(teamTricode) : null;
  const teamFullName = teamTricode ? getTeamFullName(teamTricode) : "";
  const fp5 = Number(player?.last5?.fp5 ?? 0);
  const seasonFp = Number(player?.season?.fp ?? 0);
  const palette = actionPalette(result?.recommendation?.action ?? "hold");

  return (
    <div className="space-y-3">
      {/* Player header */}
      {player && (
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-card via-muted/30 to-card">
          {teamLogo && (
            <img
              src={teamLogo}
              alt=""
              aria-hidden
              className="absolute -right-4 -top-2 w-24 h-24 opacity-[0.08] pointer-events-none select-none"
            />
          )}
          <div className="relative flex items-center gap-3 px-3 py-2.5">
            {player.core?.photo ? (
              <img src={player.core.photo} alt="" className="w-14 h-14 rounded-full object-cover bg-muted shrink-0 ring-2 ring-border" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-muted shrink-0 inline-flex items-center justify-center text-sm font-bold">
                {player.core?.name?.slice(0, 2)?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold uppercase truncate">{player.core?.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {teamLogo && <img src={teamLogo} alt="" className="w-4 h-4" />}
                <span className="text-[11px] text-muted-foreground truncate">{teamFullName} · {teamTricode}</span>
                <Badge variant={player.core?.fc_bc === "FC" ? "destructive" : "default"} className="rounded-lg text-[8px] px-1 py-0 h-4">
                  {player.core?.fc_bc}
                </Badge>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono font-black text-2xl leading-none tabular-nums">{fp5.toFixed(1)}</p>
              <p className="text-[9px] font-heading uppercase tracking-wider text-muted-foreground mt-0.5">FP5</p>
              <p className="text-[10px] font-mono text-muted-foreground tabular-nums mt-0.5">Season {seasonFp.toFixed(1)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {result.summary && (
        <div>
          <p className="text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Explanation{player?.core?.name ? ` for ${player.core.name}` : ""}
          </p>
          <div className="border-l-4 border-accent pl-3 py-1 italic text-sm leading-relaxed">
            <Quote className="h-3 w-3 inline mr-1 text-accent -mt-1" />
            {result.summary}
          </div>
        </div>
      )}

      {/* Why it scores */}
      {result.why_it_scores?.length > 0 && (
        <div>
          <p className="text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Why it scores
          </p>
          <div className="border rounded-xl divide-y bg-card">
            {result.why_it_scores.map((f: any, i: number) => {
              const Icon = factorIcon(f.factor);
              return (
                <div key={i} className="px-3 py-1.5 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-[11px] font-heading font-bold uppercase tracking-wider">{f.factor}</span>
                    <span className={`ml-auto text-[9px] font-heading font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${impactClasses(f.impact)}`}>
                      {(f.impact || "").replace("_", " ")}
                    </span>
                  </div>
                  {f.note && <p className="text-xs text-muted-foreground leading-snug pl-5">{f.note}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendation banner */}
      {result.recommendation && (
        <div className={`rounded-xl border ${palette.band} px-3 py-2.5 flex items-center gap-3`}>
          <span className={`shrink-0 inline-flex items-center justify-center font-heading font-black text-sm px-3 py-1 rounded-lg ${palette.chip}`}>
            {palette.label}
          </span>
          <span className="text-xs leading-snug">{result.recommendation.rationale}</span>
        </div>
      )}
    </div>
  );
}
