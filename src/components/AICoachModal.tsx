import { useState, useMemo, useRef, useEffect } from "react";
import { getLeagueLogo } from "@/lib/competitions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogClose } from "@radix-ui/react-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Bot, Activity, Star, ArrowLeftRight, Shield, HelpCircle, Loader2, AlertTriangle, Disc, Users, Clock, Sparkles, Quote, Gauge, Flame, DollarSign, ShieldAlert, CalendarDays, Tag, History, X as XIcon, Search, Radar, Crown, TrendingUp, Heart, GitCompare, ArrowLeft, Mic, BarChart3, Trophy } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import BallersIQMarketWatch from "@/components/ballers-iq/BallersIQMarketWatch";
import HealthDeskPanel from "@/components/ballers-iq/HealthDeskPanel";
import PlayerExplainStudio from "@/components/ballers-iq/PlayerExplainStudio";
import RosterReadPanel from "@/components/ballers-iq/RosterReadPanel";
import CaptainCallStudio from "@/components/ballers-iq/CaptainCallStudio";
import MarketWatchStudio from "@/components/ballers-iq/MarketWatchStudio";
import StylePreferencesPanel from "@/components/ai-coach/StylePreferencesPanel";
import { buildPersonalisedRoster, type DraftPreferences } from "@/lib/personalised-draft";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useUpcomingByTeam } from "@/hooks/useUpcomingByTeam";
import { useTeam } from "@/contexts/TeamContext";
import { getTeamLogo, NBA_TEAMS } from "@/lib/nba-teams";
import {
  aiAnalyzeRoster, aiPickCaptain, aiSuggestTransfers, aiInjuryMonitor, aiExplainPlayer,
  saveRoster, simulateTransactions, commitTransaction, autoPickRoster,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import InjuryReportModal from "@/components/InjuryReportModal";
import { getCurrentGameday } from "@/lib/deadlines";
import { useLeagueDeadlines, getCurrentGamedayFrom } from "@/hooks/useLeagueDeadlines";
import { useLeague } from "@/contexts/LeagueContext";
import { HOOPSFANTASY_NAME } from "@/lib/hoopsfantasy-brand";
import { useQueryClient } from "@tanstack/react-query";
import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";
import ballersIqArena from "@/assets/ballers-iq-arena.png";

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
  const { isWnba, league } = useLeague();
  const { deadlines } = useLeagueDeadlines();
  const leagueLogo = getLeagueLogo(league);
  const resolveGameday = () => getCurrentGamedayFrom(deadlines) ?? getCurrentGameday();
  const { data: rosterData } = useRosterQuery();
  const { data: playersData } = usePlayersQuery({ limit: 1000 });
  const { data: upcomingByTeam } = useUpcomingByTeam();
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
  const [activeTab, setActiveTab] = useState<string>("analyze");
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
      const { gw: cgw, day: cday } = resolveGameday();
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

  /**
   * Personalised draft: deterministic client-side scoring + greedy fill that
   * respects the user's salary archetype, experience/size/risk tilts, and
   * favourite teams. Saves the resulting roster + captain.
   */
  const handlePersonalisedDraft = async (prefs: DraftPreferences) => {
    if (!selectedTeamId) return;
    setDraftingFromEmpty(true);
    try {
      const result = buildPersonalisedRoster(allPlayers as any, prefs);
      if (!result.starters.length) {
        toast({ title: "Couldn't build a roster", description: "Loosen the constraints and try again.", variant: "destructive" });
        return;
      }
      if (!result.legal) {
        toast({ title: "Adjusted slightly to fit cap rules" });
      }
      const { gw: cgw, day: cday } = resolveGameday();
      await saveRoster({
        gw: cgw, day: cday,
        starters: result.starters.map((p) => p.core.id),
        bench: result.bench.map((p) => p.core.id),
        captain_id: result.captain?.core.id ?? 0,
      }, selectedTeamId);
      await queryClient.invalidateQueries({ queryKey: ["roster-current", selectedTeamId] });
      toast({ title: "Personalised squad drafted!", description: `Captain: ${result.captain?.core.name ?? "—"} · GW${cgw} · Day ${cday}.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Personalised draft failed", description: e?.message ?? "Try again.", variant: "destructive" });
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

  const runExplain = async (target: any) => {
    if (!target?.core?.id) return;
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
    await runExplain(found);
  };

  const handleSelectExplainPlayer = (p: any) => {
    setExplainSearch(p.core.name);
    setSelectedExplainPlayer(p);
    setShowDropdown(false);
    void runExplain(p);
  };

  const statusColor = (s: string) => {
    switch (s) { case "OUT": return "destructive"; case "Q": return "secondary"; case "DTD": return "outline"; default: return "default"; }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 border-amber-400/20 bg-[#05070d] rounded-2xl overflow-hidden flex flex-col
                   w-[92vw] max-w-[1500px] h-[92vh] max-h-[96vh]
                   shadow-[0_40px_140px_-30px_rgba(0,0,0,0.95),0_0_0_1px_hsl(45_90%_55%/0.18),inset_0_1px_0_rgba(255,255,255,0.06)]"
      >
        {/* Cinematic background layer */}
        <div className="absolute inset-0 -z-0 pointer-events-none">
          <img
            src={ballersIqArena}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover opacity-70 select-none"
            draggable={false}
          />
          {/* Top/bottom readability gradient — lighter through the middle */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#05070d]/72 via-[#05070d]/48 to-[#05070d]/88" />
          {/* Side glows (red / blue arena lighting) */}
          <div className="biq-shell-glow-blue" />
          <div className="biq-shell-glow-red" />
          {/* Ambient haze */}
          <div className="biq-shell-haze" />
          {/* Ambient light sweep */}
          <div className="biq-shell-sweep" />
          {/* Soft vignette */}
          <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
          {/* Corner bloom */}
          <div className="biq-corner-bloom" />
          {/* Top hairline glow */}
          <div className="absolute -inset-x-1/2 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />
          {/* Bottom hairline reflection */}
          <div className="absolute -inset-x-1/2 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300/25 to-transparent" />
        </div>

        {/* Broadcast header */}
        <DialogHeader className="shrink-0 relative z-[1] px-5 md:pl-8 md:pr-48 pt-2 pb-2">
          <DialogTitle className="sr-only">Ballers.IQ — HoopsFantasy Broadcast Intelligence</DialogTitle>
          <div className="flex items-center gap-4 md:gap-6">
            {/* LEFT — brand */}
            <div className="flex items-center gap-3 min-w-0">
              <BallersIQBrand
                variant="wordmark"
                forceTheme="dark"
                transparent
                className="!h-9 md:!h-11 w-auto select-none drop-shadow-[0_0_22px_rgba(252,211,77,0.5)]"
              />
              <div className="hidden md:block h-8 w-px bg-gradient-to-b from-transparent via-amber-400/40 to-transparent" />
              <span className="hidden md:block text-[10.5px] font-heading font-bold uppercase tracking-[0.32em] text-amber-100/85 whitespace-nowrap drop-shadow-[0_0_8px_rgba(252,211,77,0.25)]">
                {HOOPSFANTASY_NAME} Broadcast Intelligence
              </span>
            </div>

            {/* CENTER — context chips */}
            <div className="hidden lg:flex items-center gap-2 ml-auto mr-16">
              <span className="px-3.5 py-1.5 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-md text-[10.5px] font-heading font-bold uppercase tracking-[0.22em] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_18px_-8px_rgba(0,0,0,0.6)]">
                My Roster
              </span>
              <span className="px-3.5 py-1.5 rounded-full border border-amber-300/40 bg-amber-400/[0.12] backdrop-blur-md text-[10.5px] font-heading font-bold uppercase tracking-[0.22em] text-amber-100 shadow-[inset_0_1px_0_rgba(255,232,170,0.18),0_0_18px_-6px_rgba(252,211,77,0.5)]">
                Gameweek {gw}.{day}
              </span>
            </div>

            {/* RIGHT — utility space (close X is auto-rendered by DialogContent) */}
            <div className="lg:hidden ml-auto" />
          </div>
          {/* Divider glow */}
          <div className="mt-2 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent shadow-[0_0_8px_rgba(252,211,77,0.35)]" />
        </DialogHeader>

        {/* Explicit broadcast-grade close button. Sits above all background layers
            so the click always reaches Radix's DialogClose. */}
        <DialogClose
          aria-label="Close Ballers.IQ"
          className="absolute top-3.5 right-3.5 z-[60] inline-flex h-9 w-9 items-center justify-center rounded-xl
                     border border-white/15 bg-black/55 backdrop-blur-md text-white/85
                     transition-all hover:text-white hover:bg-white/10 hover:border-amber-300/40
                     hover:shadow-[0_0_18px_-4px_rgba(252,211,77,0.55)]
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
        >
          <XIcon className="h-4 w-4" />
        </DialogClose>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col relative z-[1] px-5 md:px-8 pb-5">
          {isRosterEmpty && (
            <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center py-6">
              <div className="w-full max-w-[1400px]">
                <StylePreferencesPanel
                  players={allPlayers as any}
                  busy={draftingFromEmpty}
                  onDraft={handlePersonalisedDraft}
                />
              </div>
            </div>
          )}
          {!isRosterEmpty && (
          <TabsList
            className="shrink-0 grid grid-cols-5 h-auto p-1.5 gap-1.5 rounded-xl
                       bg-black/60 backdrop-blur-xl border border-white/12
                       shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-1px_0_rgba(0,0,0,0.4),0_10px_36px_-12px_rgba(0,0,0,0.85)]"
          >
            {([
              { v: "analyze",   icon: Activity,      label: "Roster Read" },
              { v: "captain",   icon: Star,          label: "Captain Call" },
              { v: "transfers", icon: ArrowLeftRight,label: "Market Watch" },
              { v: "injuries",  icon: Shield,        label: "Health Desk" },
              { v: "explain",   icon: HelpCircle,    label: "Player Explain" },
            ] as const).map(({ v, icon: Icon, label }) => (
              <TabsTrigger
                key={v}
                value={v}
                className="group relative font-heading text-[11.5px] uppercase tracking-[0.2em] rounded-lg py-2.5
                           bg-amber-400/10 !text-amber-300 hover:bg-amber-400/20 hover:!text-amber-200
                           transition-all
                           data-[state=active]:!bg-amber-400 data-[state=active]:!text-blue-900 data-[state=active]:scale-[1.02] data-[state=active]:font-extrabold
                           data-[state=active]:shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_0_0_2px_hsl(45_95%_55%),0_0_28px_-4px_hsl(45_95%_60%/0.9)]"
              >
                <Icon className="h-3.5 w-3.5 mr-1.5" />{label}
                <span className="pointer-events-none absolute left-3 right-3 bottom-0.5 h-px rounded-full bg-gradient-to-r from-transparent via-amber-300/80 to-transparent opacity-0 group-data-[state=active]:opacity-100 transition-opacity" />
              </TabsTrigger>
            ))}
          </TabsList>
          )}
          {!isRosterEmpty && (

          <div className="relative flex-1 min-h-0 mt-4 rounded-xl
                          bg-black/45 backdrop-blur-xl border border-white/12
                          shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-1px_0_rgba(0,0,0,0.5),0_20px_60px_-30px_rgba(0,0,0,0.9)]
                          overflow-hidden">
            {/* Soft top glow only — grid/scanlines removed for cleaner background */}
            <div className="absolute inset-0 [background:radial-gradient(ellipse_at_top,rgba(252,211,77,0.06),transparent_55%)] pointer-events-none" />
            <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.45)_100%)] pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent pointer-events-none" />
            <div className="relative h-full overflow-y-auto space-y-3 p-4 md:p-5">
            {/* Analyze */}
            <TabsContent value="analyze" className="mt-0">
              <RosterReadPanel
                rosterData={rosterData}
                allPlayers={allPlayers}
                upcomingByTeam={upcomingByTeam}
                analyzeLoading={analyzeLoading}
                analyzeResult={analyzeResult}
                onAnalyze={handleAnalyze}
                onGoToTab={setActiveTab}
                onOpenPlayer={(p) => {
                  if (!p) return;
                  setSelectedExplainPlayer(p);
                  setExplainSearch(p.core.name);
                  setActiveTab("explain");
                  void runExplain(p);
                }}
              />
            </TabsContent>

            {/* Captain */}
            <TabsContent value="captain" className="mt-0">
              <CaptainCallStudio
                rosterData={rosterData}
                allPlayers={allPlayers}
                upcomingByTeam={upcomingByTeam}
                captainLoading={captainLoading}
                captainResult={captainResult}
                applyingCaptain={applyingCaptain}
                onPickCaptain={handleCaptain}
                onApplyCaptain={handleApplyCaptain}
                onGoToTab={setActiveTab}
                onOpenPlayer={(p) => {
                  if (!p) return;
                  setSelectedExplainPlayer(p);
                  setExplainSearch(p.core.name);
                  setActiveTab("explain");
                  void runExplain(p);
                }}
              />
            </TabsContent>

            {/* Transfers */}
            <TabsContent value="transfers" className="mt-0 space-y-3">
              <MarketWatchStudio
                rosterData={rosterData}
                allPlayers={allPlayers}
                upcomingByTeam={upcomingByTeam}
                transfersLoading={transfersLoading}
                transfersResult={transfersResult}
                simResults={simResults}
                simulatingIdx={simulatingIdx}
                committingIdx={committingIdx}
                onSuggest={handleTransfers}
                onSimulate={handleSimulate}
                onCommit={handleCommit}
                onGoToTab={setActiveTab}
                onOpenPlayer={(p) => {
                  if (!p) return;
                  setSelectedExplainPlayer(p);
                  setExplainSearch(p.core.name);
                  setActiveTab("explain");
                  void runExplain(p);
                }}
              />
            </TabsContent>

            {/* Injuries */}
            <TabsContent value="injuries" className="mt-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
              <HealthDeskPanel />
            </TabsContent>

            {/* Explain */}
            <TabsContent value="explain" className="mt-0 h-full data-[state=active]:flex data-[state=active]:flex-col">
              <PlayerExplainStudio
                allPlayers={allPlayers}
                rosterData={rosterData}
                upcomingByTeam={upcomingByTeam}
                explainSearch={explainSearch}
                onSearchChange={handleExplainSearchChange}
                explainMatches={explainMatches}
                showDropdown={showDropdown}
                setShowDropdown={setShowDropdown}
                selectedExplainPlayer={selectedExplainPlayer}
                setSelectedExplainPlayer={setSelectedExplainPlayer}
                setExplainSearch={setExplainSearch}
                recentExplained={recentExplained}
                onSelectPlayer={handleSelectExplainPlayer}
                onRecentClick={handleRecentClick}
                runExplain={runExplain}
                explainLoading={explainLoading}
                explainResult={explainResult}
                onClearResult={() => { setExplainResult(null); setSelectedExplainPlayer(null); setExplainSearch(""); }}
                onGoToTab={setActiveTab}
                onClose={() => onOpenChange(false)}
              />
            </TabsContent>
            </div>
          </div>
          )}
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

function verdictPalette(verdict: string): { chip: string; band: string; label: string } {
  const v = (verdict || "").toUpperCase();
  switch (v) {
    case "START":
      return { chip: "bg-emerald-500 text-white", band: "border-emerald-500/40 bg-emerald-500/10", label: "START" };
    case "BENCH":
      return { chip: "bg-amber-500 text-white", band: "border-amber-500/40 bg-amber-500/10", label: "BENCH" };
    case "HOLD":
      return { chip: "bg-sky-500 text-white", band: "border-sky-500/40 bg-sky-500/10", label: "HOLD" };
    case "WATCH":
      return { chip: "bg-violet-500 text-white", band: "border-violet-500/40 bg-violet-500/10", label: "WATCH" };
    case "DROP":
      return { chip: "bg-destructive text-destructive-foreground", band: "border-destructive/40 bg-destructive/10", label: "DROP" };
    default:
      return { chip: "bg-muted text-muted-foreground", band: "border-border bg-muted/30", label: v || "—" };
  }
}

function biqRatingClasses(score: number): string {
  if (score >= 85) return "text-emerald-500";
  if (score >= 70) return "text-emerald-400";
  if (score >= 55) return "text-sky-400";
  if (score >= 40) return "text-amber-500";
  return "text-destructive";
}

function riskClasses(level: string): string {
  switch ((level || "").toUpperCase()) {
    case "LOW": return "bg-emerald-500/15 text-emerald-500 border border-emerald-500/40";
    case "MEDIUM": return "bg-amber-500/15 text-amber-500 border border-amber-500/40";
    case "HIGH": return "bg-destructive/15 text-destructive border border-destructive/40";
    default: return "bg-muted text-muted-foreground border border-border";
  }
}

function salaryClasses(label: string): string {
  switch ((label || "").toLowerCase()) {
    case "underpriced": return "bg-emerald-500/15 text-emerald-500 border border-emerald-500/40";
    case "fair value": return "bg-muted text-muted-foreground border border-border";
    case "overpriced": return "bg-amber-500/15 text-amber-500 border border-amber-500/40";
    case "salary trap": return "bg-destructive/15 text-destructive border border-destructive/40";
    default: return "bg-muted text-muted-foreground border border-border";
  }
}

function scheduleClasses(label: string): string {
  switch ((label || "").toLowerCase()) {
    case "schedule boost": return "bg-emerald-500/15 text-emerald-500 border border-emerald-500/40";
    case "schedule drag": return "bg-amber-500/15 text-amber-500 border border-amber-500/40";
    case "no game risk": return "bg-destructive/15 text-destructive border border-destructive/40";
    default: return "bg-muted text-muted-foreground border border-border";
  }
}

function ExplainReport({ result, player }: { result: any; player: any }) {
  const teamTricode = player?.core?.team;
  const teamLogo = teamTricode ? getTeamLogo(teamTricode) : null;
  const teamFullName = teamTricode ? getTeamFullName(teamTricode) : "";
  const fp5 = Number(player?.last5?.fp5 ?? 0);
  const seasonFp = Number(player?.season?.fp ?? 0);
  const palette = actionPalette(result?.recommendation?.action ?? "hold");
  const verdict = String(result?.verdict ?? "").toUpperCase();
  const vPalette = verdict ? verdictPalette(verdict) : null;
  const biqRating = typeof result?.biq_rating === "number" ? result.biq_rating : null;
  const biqLabel = result?.biq_label as string | undefined;
  const archetype = result?.archetype as string | undefined;
  const formSignal = result?.form_signal as string | undefined;
  const salaryEff = result?.salary_efficiency as string | undefined;
  const riskLevel = result?.risk_level as string | undefined;
  const riskFlags = Array.isArray(result?.risk_flags) ? (result.risk_flags as string[]) : [];
  const sched = result?.schedule_context as { next_game?: string | null; games_count?: number; label?: string; warning?: string | null } | undefined;

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

      {/* Verdict + BIQ Rating */}
      {(vPalette || biqRating !== null) && (
        <div className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${vPalette ? vPalette.band : "border-border bg-muted/20"}`}>
          {vPalette && (
            <span className={`shrink-0 inline-flex items-center justify-center font-heading font-black text-sm px-3 py-1 rounded-lg ${vPalette.chip}`}>
              {vPalette.label}
            </span>
          )}
          {biqRating !== null && (
            <div className="flex items-baseline gap-1.5">
              <Gauge className={`h-3.5 w-3.5 ${biqRatingClasses(biqRating)}`} />
              <span className={`font-mono font-black text-2xl leading-none tabular-nums ${biqRatingClasses(biqRating)}`}>{biqRating}</span>
              <span className="text-[9px] font-heading uppercase tracking-wider text-muted-foreground">/100</span>
              {biqLabel && (
                <span className="ml-1 text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground">
                  {biqLabel}
                </span>
              )}
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5 flex-wrap justify-end">
            {archetype && (
              <span className="inline-flex items-center gap-1 text-[10px] font-heading font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/40">
                <Tag className="h-3 w-3" /> {archetype}
              </span>
            )}
            {formSignal && formSignal !== "Stable" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-heading font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-500 border border-orange-500/40">
                <Flame className="h-3 w-3" /> {formSignal}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Salary + Risk + Schedule grid */}
      {(salaryEff || riskLevel || sched) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {salaryEff && (
            <div className={`rounded-xl px-3 py-2 ${salaryClasses(salaryEff)}`}>
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                <span className="text-[9px] font-heading font-bold uppercase tracking-wider opacity-80">Salary</span>
              </div>
              <p className="font-heading font-bold text-xs uppercase mt-0.5">{salaryEff}</p>
            </div>
          )}
          {riskLevel && (
            <div className={`rounded-xl px-3 py-2 ${riskClasses(riskLevel)}`}>
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span className="text-[9px] font-heading font-bold uppercase tracking-wider opacity-80">Risk</span>
              </div>
              <p className="font-heading font-bold text-xs uppercase mt-0.5">{riskLevel}</p>
              {riskFlags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {riskFlags.slice(0, 4).map((f, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-md bg-background/40 border border-current/30 font-mono lowercase">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          {sched && (sched.label || typeof sched.games_count === "number" || sched.next_game) && (
            <div className={`rounded-xl px-3 py-2 ${scheduleClasses(sched.label ?? "")}`}>
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="text-[9px] font-heading font-bold uppercase tracking-wider opacity-80">Schedule</span>
              </div>
              <p className="font-heading font-bold text-xs uppercase mt-0.5">
                {sched.label ?? "—"}
                {typeof sched.games_count === "number" && (
                  <span className="ml-1 font-mono opacity-80">· {sched.games_count}G</span>
                )}
              </p>
              {sched.next_game && (
                <p className="text-[10px] font-mono mt-0.5 opacity-90">Next: {sched.next_game}</p>
              )}
              {sched.warning && (
                <p className="text-[10px] mt-0.5 opacity-90">{sched.warning}</p>
              )}
            </div>
          )}
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
