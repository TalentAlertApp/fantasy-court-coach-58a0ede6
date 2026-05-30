import { useMemo, useState } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Search, History, Radar, Crown, TrendingUp, ShieldAlert, DollarSign, CalendarDays,
  Sparkles, Activity, HelpCircle, Heart, Star, Mic, BarChart3, ArrowLeftRight, Users,
  ArrowLeft, GitCompare, Trophy, Flame, Loader2,
} from "lucide-react";
import { getTeamLogo, NBA_TEAMS } from "@/lib/nba-teams";
import { cn } from "@/lib/utils";
import PlayerModal from "@/components/PlayerModal";
import TeamModal from "@/components/TeamModal";
import BringInModal from "@/components/acquisition/BringInModal";

function getTeamFullName(tricode: string): string {
  const t = NBA_TEAMS.find((t) => t.tricode === tricode);
  return t?.name ?? tricode;
}

function GlassPanel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn(
      "relative rounded-xl border border-white/10 bg-black/45 backdrop-blur-xl",
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_60px_-30px_rgba(0,0,0,0.9)]",
      className,
    )}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />
      {children}
    </div>
  );
}

function SectionLabel({ icon: Icon, children, accent = "amber" }: { icon: any; children: React.ReactNode; accent?: "amber" | "sky" | "rose" }) {
  const color = accent === "sky" ? "text-sky-200/85" : accent === "rose" ? "text-rose-200/85" : "text-amber-100/85";
  return (
    <div className={cn("flex items-center gap-2 text-[10px] font-heading font-bold uppercase tracking-[0.22em]", color)}>
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

type Props = {
  allPlayers: any[];
  rosterData: any;
  upcomingByTeam: Record<string, any[]> | undefined;
  explainSearch: string;
  onSearchChange: (v: string) => void;
  explainMatches: any[];
  showDropdown: boolean;
  setShowDropdown: (v: boolean) => void;
  selectedExplainPlayer: any;
  setSelectedExplainPlayer: (p: any) => void;
  setExplainSearch: (v: string) => void;
  recentExplained: Array<{ id: number; name: string; team: string; photo: string | null; fc_bc: string }>;
  onSelectPlayer: (p: any) => void;
  onRecentClick: (r: { id: number; name: string }) => void;
  runExplain: (p: any) => Promise<void> | void;
  explainLoading: boolean;
  explainResult: any;
  onClearResult: () => void;
  onGoToTab: (tab: string) => void;
  onClose: () => void;
};

const REPORT_FEATURES = [
  { icon: Sparkles,       label: "Player Spotlight",   tone: "from-amber-400/15 to-amber-500/5 border-amber-400/30 text-amber-100" },
  { icon: Mic,            label: "AI CoachCast",       tone: "from-sky-400/15 to-sky-500/5 border-sky-400/30 text-sky-100" },
  { icon: BarChart3,      label: "Scoring Drivers",    tone: "from-emerald-400/15 to-emerald-500/5 border-emerald-400/30 text-emerald-100" },
  { icon: DollarSign,     label: "Salary & Value",     tone: "from-violet-400/15 to-violet-500/5 border-violet-400/30 text-violet-100" },
  { icon: ShieldAlert,    label: "Health & Risk",      tone: "from-rose-400/15 to-rose-500/5 border-rose-400/30 text-rose-100" },
  { icon: CalendarDays,   label: "Schedule Impact",    tone: "from-indigo-400/15 to-indigo-500/5 border-indigo-400/30 text-indigo-100" },
  { icon: Crown,          label: "Captain Potential",  tone: "from-yellow-300/15 to-yellow-500/5 border-yellow-300/30 text-yellow-100" },
];

export default function PlayerExplainStudio(props: Props) {
  const {
    allPlayers, rosterData, upcomingByTeam,
    explainSearch, onSearchChange, explainMatches,
    showDropdown, setShowDropdown,
    selectedExplainPlayer, setSelectedExplainPlayer, setExplainSearch,
    recentExplained, onSelectPlayer, onRecentClick, runExplain,
    explainLoading, explainResult,
    onClearResult, onGoToTab,
  } = props;

  const [modalPlayerId, setModalPlayerId] = useState<number | null>(null);
  const [modalTeamTri, setModalTeamTri] = useState<string | null>(null);
  const [bringInOpen, setBringInOpen] = useState(false);

  /* -------- roster suggestions -------- */
  const rosterIds = useMemo(() => new Set<number>([
    ...(rosterData?.roster?.starters ?? []),
    ...(rosterData?.roster?.bench ?? []),
  ].filter(Boolean)), [rosterData]);

  const rosterPlayers = useMemo(
    () => allPlayers.filter((p: any) => rosterIds.has(p.core.id)),
    [allPlayers, rosterIds],
  );

  const suggestions = useMemo(() => {
    if (!rosterPlayers.length) return null;
    const byFp5 = [...rosterPlayers].sort((a, b) => (b.last5?.fp5 ?? 0) - (a.last5?.fp5 ?? 0));
    const byValue = [...rosterPlayers].sort((a, b) => (b.last5?.value5 ?? 0) - (a.last5?.value5 ?? 0));
    const byRisk = [...rosterPlayers].sort((a, b) => (a.last5?.delta_fp ?? 0) - (b.last5?.delta_fp ?? 0));
    const bySchedule = upcomingByTeam
      ? [...rosterPlayers].sort((a, b) => (upcomingByTeam[b.core.team]?.length ?? 0) - (upcomingByTeam[a.core.team]?.length ?? 0))
      : byFp5;
    return {
      captain: byFp5[0],
      highest: byFp5[0],
      risk: byRisk[0],
      value: byValue[0],
      schedule: bySchedule[0],
    };
  }, [rosterPlayers, upcomingByTeam]);

  /* ============ STATE: REPORT ============ */
  if (explainResult && !explainLoading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between -mt-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearResult}
            className="h-7 px-2 text-white/75 hover:text-white hover:bg-white/[0.05]"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> New search
          </Button>
          <div className="text-[10px] font-heading uppercase tracking-[0.22em] text-amber-100/70">
            Player Spotlight · Broadcast
          </div>
        </div>
        {/* The existing ExplainReport is rendered by the parent through props.explainResult,
            but we need to render it here. The parent passes us the data — render it. */}
        <ExplainReportSlot result={explainResult} player={selectedExplainPlayer} onOpenPlayer={setModalPlayerId} onOpenTeam={setModalTeamTri} onBringIn={() => setBringInOpen(true)} />
        <PlayerModal playerId={modalPlayerId} open={modalPlayerId !== null} onOpenChange={(o) => !o && setModalPlayerId(null)} />
        <TeamModal tricode={modalTeamTri} open={modalTeamTri !== null} onOpenChange={(o) => !o && setModalTeamTri(null)} />
        {selectedExplainPlayer?.core && (
          <BringInModal
            open={bringInOpen}
            onOpenChange={setBringInOpen}
            target={{
              id: selectedExplainPlayer.core.id,
              name: selectedExplainPlayer.core.name,
              team: selectedExplainPlayer.core.team,
              fc_bc: selectedExplainPlayer.core.fc_bc,
              salary: selectedExplainPlayer.core.salary,
              photo: selectedExplainPlayer.core.photo ?? null,
            }}
          />
        )}
      </div>
    );
  }

  /* ============ STATE: LOADING ============ */
  if (explainLoading) {
    const teamLogo = selectedExplainPlayer ? getTeamLogo(selectedExplainPlayer.core?.team) : null;
    return (
      <div className="space-y-3">
        <GlassPanel className="p-5">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <div className="absolute inset-0 rounded-full border border-amber-400/40 animate-ping" />
              <div className="absolute inset-2 rounded-full border border-amber-400/30 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-full">
                {selectedExplainPlayer?.core?.photo ? (
                  <img
                    src={selectedExplainPlayer.core.photo}
                    alt=""
                    className="w-16 h-16 rounded-full object-cover ring-2 ring-amber-300/60 opacity-90"
                  />
                ) : (
                  <Radar className="h-10 w-10 text-amber-300 drop-shadow-[0_0_18px_rgba(252,211,77,0.6)]" />
                )}
              </div>
              <div className="absolute inset-0 rounded-full [background:conic-gradient(from_0deg,transparent,rgba(252,211,77,0.25),transparent_55%)] animate-spin" style={{ animationDuration: "3s" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-heading uppercase tracking-[0.22em] text-amber-100/80">Generating BALLERS.IQ Report</div>
              <div className="font-heading text-xl uppercase tracking-[0.12em] text-white truncate mt-1">
                {selectedExplainPlayer?.core?.name ?? "Player"}
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-white/60">
                {teamLogo && <img src={teamLogo} alt="" className="w-4 h-4 object-contain" />}
                <span>{selectedExplainPlayer?.core?.team ? getTeamFullName(selectedExplainPlayer.core.team) : ""}</span>
                <span className="text-white/30">·</span>
                <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> AI Analysis</span>
              </div>
            </div>
          </div>
        </GlassPanel>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            { icon: Activity,    label: "Scoring drivers loading" },
            { icon: ShieldAlert, label: "Risk profile loading" },
            { icon: CalendarDays,label: "Schedule loading" },
            { icon: DollarSign,  label: "Value loading" },
            { icon: Crown,       label: "Captain potential loading" },
            { icon: Mic,         label: "CoachCast loading" },
          ].map(({ icon: Icon, label }) => (
            <GlassPanel key={label} className="p-4">
              <div className="flex items-center gap-2 text-[10px] font-heading uppercase tracking-[0.18em] text-white/65">
                <Icon className="h-3.5 w-3.5 text-amber-300/70" />
                {label}
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-3 w-3/4 rounded-md bg-white/[0.06] animate-pulse" />
                <div className="h-3 w-2/3 rounded-md bg-white/[0.05] animate-pulse" />
                <div className="h-3 w-1/2 rounded-md bg-white/[0.04] animate-pulse" />
              </div>
            </GlassPanel>
          ))}
        </div>
      </div>
    );
  }

  /* ============ STATE: PRE-SELECTION ============ */
  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
        <div className="grid gap-3 md:grid-cols-12">
          {/* LEFT — Search Hero */}
          <GlassPanel className="md:col-span-5 p-5 md:p-6">
            <SectionLabel icon={HelpCircle}>Player Explain</SectionLabel>
            <h3 className="mt-3 font-heading text-2xl md:text-3xl uppercase tracking-[0.14em] text-white leading-tight">
              AI Scouting <span className="text-amber-300">Spotlight</span>
            </h3>
            <p className="mt-2 text-[12.5px] text-white/65 leading-relaxed">
              Search any player in this league and generate a BALLERS.IQ spotlight report.
            </p>

            <div className="mt-5 relative">
              <Popover open={showDropdown && explainMatches.length > 0} onOpenChange={setShowDropdown}>
                <div className="flex gap-2">
                  <PopoverAnchor asChild>
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-300/80 pointer-events-none" />
                      <Input
                        placeholder="Search player name, team, position…"
                        value={explainSearch}
                        onChange={(e) => onSearchChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const target = selectedExplainPlayer ?? explainMatches[0];
                            if (target) {
                              setSelectedExplainPlayer(target);
                              setExplainSearch(target.core.name);
                              setShowDropdown(false);
                              void runExplain(target);
                            }
                          }
                        }}
                        className="h-12 pl-10 pr-3 rounded-xl bg-black/55 border-white/15 text-white placeholder:text-white/40
                                   focus-visible:ring-amber-300/40 focus-visible:border-amber-300/50
                                   shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                      />
                    </div>
                  </PopoverAnchor>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-12 px-3 rounded-xl bg-black/55 border-white/15 text-white/80 hover:text-white hover:bg-white/[0.05]"
                        disabled={recentExplained.length === 0}
                        title="Recently explained"
                        aria-label="Recently explained"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl">
                      <DropdownMenuLabel className="font-heading uppercase text-[10px] tracking-wider">
                        Recent · last 5
                      </DropdownMenuLabel>
                      {recentExplained.length === 0 ? (
                        <DropdownMenuItem disabled className="text-xs italic">No history yet</DropdownMenuItem>
                      ) : recentExplained.map((r) => {
                        const logo = getTeamLogo(r.team);
                        return (
                          <DropdownMenuItem key={r.id} onSelect={() => onRecentClick(r)} className="text-xs gap-2 relative overflow-hidden">
                            {logo && <img src={logo} alt="" className="pointer-events-none absolute -right-2 top-1/2 -translate-y-1/2 h-10 w-10 object-contain opacity-[0.18] rotate-12 select-none" />}
                            {r.photo ? (
                              <img src={r.photo} alt="" className="w-5 h-5 rounded-full object-cover object-[center_15%] bg-card relative z-10" />
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-card text-[8px] font-bold inline-flex items-center justify-center relative z-10">{r.name.slice(0, 1)}</span>
                            )}
                            <span className="truncate relative z-10">{r.name}</span>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={6}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  className="p-0 rounded-xl w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-y-auto z-[100]
                             bg-black/85 backdrop-blur-xl border-white/15"
                >
                  {explainMatches.map((p) => {
                    const logo = getTeamLogo(p.core.team);
                    const teamFullName = getTeamFullName(p.core.team);
                    return (
                      <button
                        key={p.core.id}
                        onClick={() => onSelectPlayer(p)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-amber-400/[0.08] transition-all text-left group relative overflow-hidden border-b border-white/5 last:border-b-0"
                      >
                        {logo && (
                          <img src={logo} alt="" className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 opacity-[0.08] pointer-events-none group-hover:opacity-[0.22] group-hover:scale-125 transition-all" />
                        )}
                        {p.core.photo ? (
                          <img src={p.core.photo} alt="" className="w-9 h-9 rounded-full object-cover object-[center_15%] bg-muted shrink-0 ring-1 ring-white/10 group-hover:ring-amber-300/60 transition-all relative z-10" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-[10px] font-bold shrink-0 relative z-10 text-white/80">
                            {p.core.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0 relative z-10">
                          <p className="text-sm font-heading font-semibold truncate text-white">{p.core.name}</p>
                          <div className="flex items-center gap-1.5">
                            {logo && <img src={logo} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />}
                            <span className="text-[10px] text-white/55">{teamFullName}</span>
                            <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-1 py-0 rounded-md h-3.5">
                              {p.core.fc_bc}
                            </Badge>
                            {p.core.pos && <span className="text-[9px] text-white/40">{p.core.pos}</span>}
                          </div>
                        </div>
                        <div className="relative z-10 shrink-0 ml-2 text-right">
                          <span className="font-mono text-[12px] font-bold text-amber-200">{Number((p as any).last5?.fp5 ?? 0).toFixed(1)}</span>
                          <span className="text-[8px] text-white/50 ml-0.5">FP5</span>
                        </div>
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
              <p className="mt-2 text-[10.5px] text-white/45">
                Tip: type a team name or position to filter.
              </p>
            </div>
          </GlassPanel>

          {/* CENTER — Recent Explains */}
          <GlassPanel className="md:col-span-4 p-5">
            <SectionLabel icon={History}>Recent Explains</SectionLabel>
            <div className="mt-3 space-y-2">
              {recentExplained.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 px-3 py-6 text-center">
                  <Radar className="h-5 w-5 text-white/35 mx-auto mb-1.5" />
                  <p className="text-[11px] text-white/45">No recent reports yet.</p>
                  <p className="text-[10px] text-white/35 mt-0.5">Generated reports will appear here.</p>
                </div>
              ) : recentExplained.map((r) => {
                const logo = getTeamLogo(r.team);
                return (
                  <button
                    key={r.id}
                    onClick={() => onRecentClick(r)}
                    className="w-full flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-amber-400/[0.06] hover:border-amber-300/30 px-3 py-2 transition-all group relative overflow-hidden"
                  >
                    {logo && <img src={logo} alt="" className="absolute -right-2 -bottom-2 w-14 h-14 object-contain opacity-[0.08] group-hover:opacity-[0.18] transition-all rotate-6" />}
                    {r.photo ? (
                      <img src={r.photo} alt="" className="w-9 h-9 rounded-full object-cover object-[center_15%] ring-1 ring-white/15 group-hover:ring-amber-300/60 transition-all relative z-10" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-white/[0.06] inline-flex items-center justify-center text-[10px] font-bold text-white/80 relative z-10">
                        {r.name.slice(0, 1)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-left relative z-10">
                      <div className="text-[12px] font-heading font-semibold text-white truncate">{r.name}</div>
                      <div className="flex items-center gap-1.5 text-[10px] text-white/55">
                        {logo && <img src={logo} alt="" className="w-3 h-3 object-contain" />}
                        <span>{getTeamFullName(r.team)}</span>
                        <Badge variant={r.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-1 py-0 rounded-md h-3.5">{r.fc_bc}</Badge>
                      </div>
                    </div>
                    <Radar className="h-3.5 w-3.5 text-amber-300/60 group-hover:text-amber-300 transition-colors relative z-10" />
                  </button>
                );
              })}
            </div>
          </GlassPanel>

          {/* RIGHT — What you get */}
          <GlassPanel className="md:col-span-3 p-5">
            <SectionLabel icon={Sparkles}>In your report</SectionLabel>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {REPORT_FEATURES.map(({ icon: Icon, label, tone }) => (
                <div key={label} className={cn("rounded-lg border bg-gradient-to-b px-3 py-2 flex items-center gap-2", tone)}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[10.5px] font-heading uppercase tracking-[0.16em]">{label}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>

        {/* SUGGESTED FROM ROSTER */}
        {suggestions && (
          <GlassPanel className="p-5">
            <div className="flex items-center justify-between">
              <SectionLabel icon={Trophy}>Suggested from your roster</SectionLabel>
              <span className="text-[10px] font-heading uppercase tracking-[0.18em] text-white/45">tap to scout</span>
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { player: suggestions.captain, label: "Captain Pick", icon: Crown,        tint: "from-amber-400/15 to-amber-500/5 border-amber-400/30 text-amber-100" },
                { player: suggestions.highest, label: "Highest FP5",  icon: TrendingUp,   tint: "from-emerald-400/15 to-emerald-500/5 border-emerald-400/30 text-emerald-100" },
                { player: suggestions.risk,    label: "Biggest Risk", icon: ShieldAlert,  tint: "from-rose-400/15 to-rose-500/5 border-rose-400/30 text-rose-100" },
                { player: suggestions.value,   label: "Best Value",   icon: DollarSign,   tint: "from-violet-400/15 to-violet-500/5 border-violet-400/30 text-violet-100" },
                { player: suggestions.schedule,label: "Schedule Boost", icon: CalendarDays, tint: "from-sky-400/15 to-sky-500/5 border-sky-400/30 text-sky-100" },
              ].map(({ player, label, icon: Icon, tint }) => {
                if (!player) return null;
                const logo = getTeamLogo(player.core.team);
                return (
                  <button
                    key={label}
                    onClick={() => {
                      setSelectedExplainPlayer(player);
                      setExplainSearch(player.core.name);
                      void runExplain(player);
                    }}
                    className={cn(
                      "relative overflow-hidden rounded-xl border bg-gradient-to-b px-3 py-3 text-left group transition-all",
                      "hover:scale-[1.02] hover:shadow-[0_0_28px_-8px_rgba(252,211,77,0.5)]",
                      tint,
                    )}
                  >
                    {logo && <img src={logo} alt="" className="absolute -right-3 -bottom-3 w-16 h-16 object-contain opacity-[0.1] group-hover:opacity-[0.22] transition-all rotate-6" />}
                    <div className="flex items-center gap-1.5 text-[9px] font-heading uppercase tracking-[0.18em] opacity-90 relative z-10">
                      <Icon className="h-3 w-3" />
                      {label}
                    </div>
                    <div className="mt-2 flex items-center gap-2 relative z-10">
                      {player.core.photo ? (
                        <img src={player.core.photo} alt="" className="w-9 h-9 rounded-full object-cover object-[center_15%] ring-1 ring-white/15" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-white/[0.08] inline-flex items-center justify-center text-[10px] font-bold">
                          {player.core.name.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-[12px] font-heading font-bold truncate">{player.core.name}</div>
                        <div className="text-[10px] opacity-70 font-mono">FP5 {Number(player.last5?.fp5 ?? 0).toFixed(1)}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassPanel>
        )}
      </div>
    </div>
  );
}

import ExplainReport from "@/components/ballers-iq/ExplainReport";
function ExplainReportSlot(p: { result: any; player: any; onOpenPlayer?: (id: number) => void; onOpenTeam?: (tricode: string) => void; onBringIn?: () => void }) {
  return <ExplainReport result={p.result} player={p.player} onOpenPlayer={p.onOpenPlayer} onOpenTeam={p.onOpenTeam} onBringIn={p.onBringIn} />;
}