import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
   Activity, Loader2, Crown, ShieldAlert, DollarSign, CalendarDays, Users,
   TrendingUp, Sparkles, Mic, Trophy, Flame, Heart, ArrowLeftRight, BarChart3,
   Shield, Gauge, Radar, AlertTriangle, CheckCircle2, Quote, Star, Target,
 } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";

type Props = {
   rosterData: any;
   allPlayers: any[];
   upcomingByTeam: Record<string, any[]> | undefined;
   analyzeLoading: boolean;
   analyzeResult: any;
   onAnalyze: () => void;
   onGoToTab: (tab: string) => void;
   onOpenPlayer?: (player: any) => void;
 };

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

function SectionLabel({ icon: Icon, children, accent = "amber" }: { icon: any; children: React.ReactNode; accent?: "amber" | "sky" | "rose" | "emerald" }) {
   const color = accent === "sky" ? "text-sky-200/85"
     : accent === "rose" ? "text-rose-200/85"
     : accent === "emerald" ? "text-emerald-200/85"
     : "text-amber-100/85";
   return (
     <div className={cn("flex items-center gap-2 text-[10px] font-heading font-bold uppercase tracking-[0.22em]", color)}>
       <Icon className="h-3.5 w-3.5" />
       {children}
     </div>
   );
 }

const CHECKS = [
   { icon: Users,        label: "Lineup Balance" },
   { icon: Crown,        label: "Captain Status" },
   { icon: DollarSign,   label: "Salary Use" },
   { icon: Star,         label: "Starter Strength" },
   { icon: Shield,       label: "Bench Depth" },
   { icon: CalendarDays, label: "Schedule Exposure" },
   { icon: Heart,        label: "Injury Risk" },
   { icon: TrendingUp,   label: "Upgrade Windows" },
 ];

const LOADING_STEPS = [
   { icon: Users, label: "Checking lineup balance" },
   { icon: Crown, label: "Calculating captain edge" },
   { icon: CalendarDays, label: "Reading schedule context" },
   { icon: DollarSign, label: "Measuring salary efficiency" },
   { icon: ShieldAlert, label: "Detecting risk flags" },
 ];

function deriveVerdict(result: any, snapshot: any): { label: string; tone: "good" | "warn" | "bad"; hint: string } {
   if (!result) return { label: "Analyzing", tone: "good", hint: "" };
   const weak = (result.weaknesses?.length ?? 0);
   const strong = (result.strengths?.length ?? 0);
   if (!snapshot?.captainSet) return { label: "Needs Captain", tone: "warn", hint: "Lock in a captain before the deadline." };
   if (weak >= 3 && weak > strong) return { label: "Risky Build", tone: "bad", hint: "Multiple weaknesses detected." };
   if (snapshot?.bankRemaining > 8) return { label: "Upgrade Window", tone: "warn", hint: "Bank available to improve starters." };
   if (strong >= 3) return { label: "High Upside", tone: "good", hint: "Roster is firing — protect the edge." };
   return { label: "Good Position", tone: "good", hint: "Solid build, minor tweaks possible." };
 }

export default function RosterReadPanel({
   rosterData, allPlayers, upcomingByTeam, analyzeLoading, analyzeResult, onAnalyze, onGoToTab, onOpenPlayer,
 }: Props) {
   /* -------- snapshot -------- */
   const snapshot = useMemo(() => {
     const r = rosterData?.roster;
     const starters: number[] = r?.starters ?? [];
     const bench: number[] = r?.bench ?? [];
     const ids = [...starters, ...bench].filter((x) => x && x > 0);
     const players = ids.map((id) => allPlayers.find((p: any) => p.core.id === id)).filter(Boolean) as any[];
     const fcCount = players.filter((p) => p.core.fc_bc === "FC").length;
     const bcCount = players.filter((p) => p.core.fc_bc === "BC").length;
     const captainId = r?.captain_id ?? 0;
     const captainPlayer = captainId ? allPlayers.find((p: any) => p.core.id === captainId) : null;
     const salaryUsed = players.reduce((s, p) => s + (Number(p.core.salary) || 0), 0);
     const starterPlayers = starters.map((id) => allPlayers.find((p: any) => p.core.id === id)).filter(Boolean) as any[];
     const benchPlayers = bench.map((id) => allPlayers.find((p: any) => p.core.id === id)).filter(Boolean) as any[];
     // Today (Lisbon)
     const todayLisbon = new Intl.DateTimeFormat("en-CA", {
       timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
     }).format(new Date());
     const activeToday = starterPlayers.filter((p) => (upcomingByTeam?.[p.core.team] ?? []).some((g: any) => g.date === todayLisbon)).length;
     const noGameThisWeek = starterPlayers.filter((p) => !(upcomingByTeam?.[p.core.team]?.length)).length;
     const riskStarters = starterPlayers.filter((p) => {
       const inj = (p.core.injury ?? "").toString().toUpperCase();
       return inj && inj !== "—" && inj !== "PROBABLE";
     }).length;
     return {
       starters, bench, ids, players, fcCount, bcCount,
       captainId, captainPlayer,
       captainSet: captainId > 0,
       salaryUsed: Math.round(salaryUsed * 10) / 10,
       bankRemaining: Number(r?.bank_remaining ?? 0),
       gw: r?.gw ?? 1, day: r?.day ?? 1,
       startersFilled: starters.filter((x) => x && x > 0).length,
       benchFilled: bench.filter((x) => x && x > 0).length,
       starterPlayers, benchPlayers,
       activeToday, noGameThisWeek, riskStarters,
       deadline: r?.deadline_utc ?? null,
     };
   }, [rosterData, allPlayers, upcomingByTeam]);

   /* -------- quick reads (preview) -------- */
   const quickReads = useMemo(() => {
     const byFp5 = [...snapshot.starterPlayers].sort((a, b) => (b.last5?.fp5 ?? 0) - (a.last5?.fp5 ?? 0));
     const byValue = [...snapshot.players].sort((a, b) => (b.last5?.value5 ?? 0) - (a.last5?.value5 ?? 0));
      const riskPlayer = snapshot.starterPlayers.find((p: any) => {
        const inj = (p.core.injury ?? "").toString().toUpperCase();
        return inj && inj !== "—" && inj !== "PROBABLE";
      });
      const noGamePlayer = snapshot.starterPlayers.find((p: any) => !(upcomingByTeam?.[p.core.team]?.length));
     return {
       captainWatch: byFp5[0],
       valuePick: byValue[0],
       riskCount: snapshot.riskStarters,
       scheduleBoost: byFp5[1],
        riskPlayer,
        noGamePlayer,
     };
    }, [snapshot, upcomingByTeam]);

   /* ============ STATE: LOADING ============ */
   if (analyzeLoading) {
     return (
       <div className="space-y-3">
         <GlassPanel className="p-5">
           <div className="flex items-center gap-4">
             <div className="relative w-20 h-20 shrink-0">
               <div className="absolute inset-0 rounded-full border border-amber-400/40 animate-ping" />
               <div className="absolute inset-2 rounded-full border border-amber-400/30 animate-pulse" />
               <div className="absolute inset-0 flex items-center justify-center">
                 <Gauge className="h-10 w-10 text-amber-300 drop-shadow-[0_0_18px_rgba(252,211,77,0.6)]" />
               </div>
               <div className="absolute inset-0 rounded-full [background:conic-gradient(from_0deg,transparent,rgba(252,211,77,0.25),transparent_55%)] animate-spin" style={{ animationDuration: "3s" }} />
             </div>
             <div className="flex-1 min-w-0">
               <div className="text-[10px] font-heading uppercase tracking-[0.22em] text-amber-100/80">Analyzing Roster</div>
               <div className="font-heading text-xl uppercase tracking-[0.12em] text-white truncate mt-1">CoachCast in progress…</div>
               <div className="text-[11px] text-white/55 mt-1 inline-flex items-center gap-1.5">
                 <Loader2 className="h-3 w-3 animate-spin" /> Scanning starters, bench, captain and schedule
               </div>
             </div>
           </div>
         </GlassPanel>
         <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
           {LOADING_STEPS.map(({ icon: Icon, label }) => (
             <GlassPanel key={label} className="p-3">
               <div className="flex items-center gap-2 text-[10px] font-heading uppercase tracking-[0.18em] text-white/65">
                 <Icon className="h-3.5 w-3.5 text-amber-300/70" /> {label}
               </div>
               <div className="mt-2 space-y-1.5">
                 <div className="h-2.5 w-3/4 rounded-md bg-white/[0.06] animate-pulse" />
                 <div className="h-2.5 w-2/3 rounded-md bg-white/[0.05] animate-pulse" />
               </div>
             </GlassPanel>
           ))}
         </div>
       </div>
     );
   }

   /* ============ STATE: REPORT ============ */
   if (analyzeResult) {
     const verdict = deriveVerdict(analyzeResult, snapshot);
     const toneChip = verdict.tone === "bad"
       ? "bg-destructive text-destructive-foreground"
       : verdict.tone === "warn"
         ? "bg-amber-500 text-white"
         : "bg-emerald-500 text-white";
     const drivers: string[] = [];
     if (snapshot.captainPlayer) drivers.push(`Captain · ${snapshot.captainPlayer.core.name}`);
     drivers.push(`${snapshot.fcCount}FC / ${snapshot.bcCount}BC`);
     if (snapshot.bankRemaining > 0) drivers.push(`Bank $${snapshot.bankRemaining.toFixed(1)}M`);
     if (snapshot.riskStarters > 0) drivers.push(`${snapshot.riskStarters} risk`);

     return (
       <div className="space-y-3">
         {/* HERO — verdict */}
         <div className="relative overflow-hidden rounded-2xl border border-amber-300/25 bg-gradient-to-br from-black/70 via-black/55 to-black/70 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,232,170,0.18),0_30px_80px_-30px_rgba(0,0,0,0.9)]">
           <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
           <div className="relative grid md:grid-cols-12 gap-3 px-4 py-3">
             <div className="md:col-span-7 min-w-0">
               <div className="text-[10px] font-heading uppercase tracking-[0.22em] text-amber-100/75">CoachCast — Roster Verdict</div>
               <div className="mt-1 flex items-center gap-2 flex-wrap">
                 <span className={cn("inline-flex items-center font-heading font-black uppercase text-sm px-3 py-1.5 rounded-lg tracking-[0.06em]", toneChip)}>
                   {verdict.label}
                 </span>
                 <Button size="sm" variant="ghost" onClick={onAnalyze} className="h-7 px-2 text-[10px] uppercase tracking-[0.18em] text-white/70 hover:text-white hover:bg-white/[0.05]">
                   <Activity className="h-3 w-3 mr-1" /> Re-analyze
                 </Button>
               </div>
               <p className="mt-2 text-[12.5px] leading-snug text-white/85">
                 {analyzeResult.summary_bullets?.[0] ?? verdict.hint}
               </p>
               {drivers.length > 0 && (
                 <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                   {drivers.map((d, i) => (
                     <span key={i} className="px-2 py-0.5 rounded-md border border-white/15 bg-white/[0.04] text-[10px] font-heading uppercase tracking-[0.14em] text-white/75">
                       {d}
                     </span>
                   ))}
                 </div>
               )}
             </div>
             <div className="md:col-span-5 grid grid-cols-3 gap-2 self-center">
               <Stat label="Starters" value={`${snapshot.startersFilled}/5`} tone="default" />
               <Stat label="Bank" value={`$${snapshot.bankRemaining.toFixed(1)}M`} tone={snapshot.bankRemaining > 0 ? "good" : "default"} />
               <Stat label="Risk" value={String(snapshot.riskStarters)} tone={snapshot.riskStarters > 0 ? "bad" : "good"} />
             </div>
           </div>
         </div>

         {/* MAIN GRID */}
         <div className="grid gap-3 lg:grid-cols-12">
           {/* LEFT — Summary + Strengths/Weaknesses */}
           <div className="lg:col-span-8 space-y-3">
             {analyzeResult.summary_bullets?.length > 0 && (
               <GlassPanel className="p-4">
                 <SectionLabel icon={Sparkles}>Roster Summary</SectionLabel>
                 <div className="mt-3 grid gap-2 sm:grid-cols-2">
                   {analyzeResult.summary_bullets.map((b: string, i: number) => (
                     <div key={i} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/85 leading-snug flex gap-2">
                       <Sparkles className="h-3 w-3 text-amber-300/80 shrink-0 mt-0.5" /> {b}
                     </div>
                   ))}
                 </div>
               </GlassPanel>
             )}
             <div className="grid gap-3 md:grid-cols-2">
               {analyzeResult.strengths?.length > 0 && (
                 <GlassPanel className="p-4">
                   <SectionLabel icon={CheckCircle2} accent="emerald">Strengths</SectionLabel>
                   <ul className="mt-3 space-y-1.5">
                     {analyzeResult.strengths.map((s: string, i: number) => (
                       <li key={i} className="flex items-start gap-2 text-[12px] text-white/85 leading-snug">
                         <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" /> {s}
                       </li>
                     ))}
                   </ul>
                 </GlassPanel>
               )}
               {analyzeResult.weaknesses?.length > 0 && (
                 <GlassPanel className="p-4">
                   <SectionLabel icon={AlertTriangle} accent="rose">Risk Flags</SectionLabel>
                   <ul className="mt-3 space-y-1.5">
                     {analyzeResult.weaknesses.map((w: string, i: number) => (
                       <li key={i} className="flex items-start gap-2 text-[12px] text-white/85 leading-snug">
                         <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" /> {w}
                       </li>
                     ))}
                   </ul>
                 </GlassPanel>
               )}
             </div>

           </div>

           {/* RIGHT — Signal Rail */}
           <div className="lg:col-span-4 space-y-3">
             <GlassPanel className="p-4">
               <SectionLabel icon={Radar}>Intelligence Signals</SectionLabel>
               <div className="mt-3 space-y-2">
                 <Signal icon={Crown} title="Captain Watch" chip={snapshot.captainSet ? "Locked" : "Open"} tone={snapshot.captainSet ? "good" : "warn"}
                   note={snapshot.captainPlayer ? snapshot.captainPlayer.core.name : "Pick a captain before the deadline."} />
                 <Signal icon={Heart} title="Health Watch" chip={`${snapshot.riskStarters} risk`} tone={snapshot.riskStarters >= 2 ? "bad" : snapshot.riskStarters === 1 ? "warn" : "good"}
                   note={snapshot.riskStarters > 0 ? "Open Health Desk for status." : "No injury concerns in starters."} />
                 <Signal icon={DollarSign} title="Salary Cushion" chip={`$${snapshot.bankRemaining.toFixed(1)}M`} tone={snapshot.bankRemaining > 5 ? "good" : snapshot.bankRemaining > 0 ? "warn" : "default"}
                   note={snapshot.bankRemaining > 0 ? "Bank available for upgrades." : "Cap maxed — explore swaps."} />
                 <Signal icon={CalendarDays} title="Schedule" chip={`${snapshot.activeToday} today`} tone={snapshot.noGameThisWeek >= 2 ? "warn" : "good"}
                   note={snapshot.noGameThisWeek > 0 ? `${snapshot.noGameThisWeek} starter${snapshot.noGameThisWeek > 1 ? "s" : ""} with no game.` : "All starters have games."} />
                 {quickReads.valuePick && (
                   <Signal icon={TrendingUp} title="Upgrade Opportunity" chip="Look at" tone="good"
                     note={`${quickReads.valuePick.core.name} · best value index.`} />
                 )}
               </div>
             </GlassPanel>
           </div>
         </div>
       </div>
     );
   }

   /* ============ STATE: PRE-ANALYSIS ============ */
   return (
     <div className="space-y-3">
       <div className="grid gap-3 md:grid-cols-12">
         {/* LEFT — Hero */}
         <GlassPanel className="md:col-span-5 p-5 md:p-6">
           <SectionLabel icon={Activity}>Roster Read</SectionLabel>
           <h3 className="mt-3 font-heading text-2xl md:text-3xl uppercase tracking-[0.14em] text-white leading-tight">
             Lineup <span className="text-amber-300">Intelligence</span>
           </h3>
           <p className="mt-2 text-[12.5px] text-white/65 leading-relaxed">
             Analyze your current lineup, captain setup, salary structure and gameweek outlook.
           </p>
           <Button
             size="lg"
             onClick={onAnalyze}
             className="mt-5 w-full font-heading uppercase tracking-[0.18em] bg-gradient-to-b from-amber-300 to-amber-500 text-black hover:from-amber-200 hover:to-amber-400 shadow-[0_0_28px_-6px_rgba(252,211,77,0.7)]"
           >
             <Activity className="h-4 w-4 mr-2" /> Analyze My Roster
           </Button>
           <p className="mt-2 text-[10.5px] text-white/45 leading-snug">
             Uses your current starters, bench, captain, salary, gameweek and schedule context.
           </p>
         </GlassPanel>

         {/* CENTER — Checks */}
         <GlassPanel className="md:col-span-4 p-5">
           <SectionLabel icon={Sparkles}>What Ballers.IQ will check</SectionLabel>
           <div className="mt-3 grid grid-cols-2 gap-2">
             {CHECKS.map(({ icon: Icon, label }) => (
               <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 flex items-center gap-2">
                 <Icon className="h-3.5 w-3.5 text-amber-300/85" />
                 <span className="text-[10.5px] font-heading uppercase tracking-[0.14em] text-white/85">{label}</span>
               </div>
             ))}
           </div>
         </GlassPanel>

         {/* RIGHT — Snapshot */}
         <GlassPanel className="md:col-span-3 p-5">
           <SectionLabel icon={Gauge}>Roster Snapshot</SectionLabel>
           <div className="mt-3 space-y-1.5 text-[11px]">
             <SnapRow k="FC / BC" v={`${snapshot.fcCount} / ${snapshot.bcCount}`} />
             <SnapRow k="Starters" v={`${snapshot.startersFilled}/5`} />
             <SnapRow k="Bench" v={`${snapshot.benchFilled}/5`} />
             <SnapRow k="Bank" v={`$${snapshot.bankRemaining.toFixed(1)}M`} tone={snapshot.bankRemaining > 0 ? "good" : "default"} />
             <SnapRow k="Salary used" v={`$${snapshot.salaryUsed.toFixed(1)}M`} />
             <SnapRow k="Captain" v={snapshot.captainPlayer ? snapshot.captainPlayer.core.name : "—"} tone={snapshot.captainSet ? "good" : "warn"} />
             <SnapRow k="Gameweek" v={`GW ${snapshot.gw} · Day ${snapshot.day}`} />
           </div>
         </GlassPanel>
       </div>

       {/* BOTTOM — Quick Reads */}
       <GlassPanel className="p-4">
         <SectionLabel icon={Trophy}>Quick Reads</SectionLabel>
         <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
            <QuickRead icon={Crown}        label="Captain Watch"      value={quickReads.captainWatch?.core?.name ?? "—"} tint="from-amber-400/15 to-amber-500/5 border-amber-400/30 text-amber-100"  onClick={quickReads.captainWatch && onOpenPlayer ? () => onOpenPlayer(quickReads.captainWatch) : undefined} />
            <QuickRead icon={TrendingUp}   label="Market Opportunity" value={quickReads.valuePick?.core?.name ?? "—"}    tint="from-violet-400/15 to-violet-500/5 border-violet-400/30 text-violet-100" onClick={quickReads.valuePick && onOpenPlayer ? () => onOpenPlayer(quickReads.valuePick) : undefined} />
            <QuickRead icon={Heart}        label="Health Exposure"    value={quickReads.riskPlayer?.core?.name ?? (snapshot.riskStarters > 0 ? `${snapshot.riskStarters} starter${snapshot.riskStarters > 1 ? "s" : ""}` : "Clear")} tint="from-rose-400/15 to-rose-500/5 border-rose-400/30 text-rose-100" onClick={quickReads.riskPlayer && onOpenPlayer ? () => onOpenPlayer(quickReads.riskPlayer) : undefined} />
            <QuickRead icon={CalendarDays} label="Schedule Boost"     value={quickReads.scheduleBoost?.core?.name ?? `${snapshot.activeToday} active today`} tint="from-sky-400/15 to-sky-500/5 border-sky-400/30 text-sky-100" onClick={quickReads.scheduleBoost && onOpenPlayer ? () => onOpenPlayer(quickReads.scheduleBoost) : undefined} />
            <QuickRead icon={ShieldAlert}  label="Risk Flags"         value={quickReads.noGamePlayer?.core?.name ?? (snapshot.noGameThisWeek > 0 ? `${snapshot.noGameThisWeek} no-game` : "Clean")} tint="from-emerald-400/15 to-emerald-500/5 border-emerald-400/30 text-emerald-100" onClick={quickReads.noGamePlayer && onOpenPlayer ? () => onOpenPlayer(quickReads.noGamePlayer) : undefined} />
         </div>
       </GlassPanel>
     </div>
   );
 }

/* ---------- helpers ---------- */

function SnapRow({ k, v, tone = "default" }: { k: string; v: string; tone?: "default" | "good" | "warn" | "bad" }) {
   const cls = tone === "good" ? "text-emerald-300"
     : tone === "warn" ? "text-amber-300"
     : tone === "bad" ? "text-rose-300"
     : "text-white/90";
   return (
     <div className="flex items-center justify-between gap-2 border-b border-white/5 last:border-b-0 pb-1 last:pb-0">
       <span className="text-[10px] font-heading uppercase tracking-[0.16em] text-white/55">{k}</span>
       <span className={cn("font-heading font-bold text-[11px] uppercase tracking-[0.06em] truncate max-w-[60%] text-right", cls)}>{v}</span>
     </div>
   );
 }

function Stat({ label, value, tone }: { label: string; value: string; tone: "default" | "good" | "bad" }) {
   const valCls = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : "text-white/95";
   return (
     <div className="rounded-lg border border-white/10 bg-black/45 px-2.5 py-1.5">
       <div className="text-[9px] font-heading uppercase tracking-[0.2em] text-white/55">{label}</div>
       <div className={cn("font-mono font-black text-lg tabular-nums leading-tight", valCls)}>{value}</div>
     </div>
   );
 }

function QuickRead({ icon: Icon, label, value, tint, onClick }: { icon: any; label: string; value: string; tint: string; onClick?: () => void }) {
   const inner = (
     <>
       <div className="flex items-center gap-1.5 text-[9px] font-heading uppercase tracking-[0.18em] opacity-90">
         <Icon className="h-3 w-3" /> {label}
       </div>
       <div className="mt-1.5 font-heading font-bold text-sm truncate">{value}</div>
     </>
   );
   const cls = cn(
     "relative overflow-hidden rounded-xl border bg-gradient-to-b px-3 py-3 text-left w-full transition-all",
     onClick && "hover:brightness-125 hover:-translate-y-0.5 hover:shadow-[0_0_24px_-6px_rgba(252,211,77,0.4)] cursor-pointer",
     tint,
   );
   return onClick
     ? <button type="button" onClick={onClick} className={cls}>{inner}</button>
     : <div className={cls}>{inner}</div>;
 }

function Signal({ icon: Icon, title, chip, tone, note }: { icon: any; title: string; chip: string; tone: "good" | "warn" | "bad" | "default"; note: string }) {
   const chipCls = tone === "good" ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/40"
     : tone === "warn" ? "bg-amber-400/15 text-amber-200 border-amber-400/40"
     : tone === "bad" ? "bg-destructive/20 text-red-200 border-red-500/40"
     : "bg-white/[0.06] text-white/70 border-white/15";
   return (
     <div className="flex items-start gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
       <Icon className="h-3.5 w-3.5 text-amber-300/85 shrink-0 mt-0.5" />
       <div className="flex-1 min-w-0">
         <div className="flex items-center gap-1.5">
           <span className="text-[10px] font-heading font-bold uppercase tracking-[0.16em] text-white/85 truncate">{title}</span>
           <span className={cn("ml-auto text-[9px] font-heading font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border", chipCls)}>{chip}</span>
         </div>
         <p className="text-[10.5px] text-white/60 leading-snug mt-0.5 truncate">{note}</p>
       </div>
     </div>
   );
 }

function ActionBtn({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
   return (
     <button
       onClick={onClick}
       className="rounded-lg border border-white/12 bg-black/40 hover:bg-amber-400/[0.08] hover:border-amber-300/40 px-2.5 py-2 text-left transition-all group"
     >
       <div className="flex items-center gap-2">
         <Icon className="h-3.5 w-3.5 text-amber-300/85 group-hover:text-amber-200" />
         <span className="text-[10.5px] font-heading uppercase tracking-[0.16em] text-white/85 group-hover:text-white">{label}</span>
       </div>
     </button>
   );
 }

function LineupRow({ label, players, captainId, upcomingByTeam, dim }: { label: string; players: any[]; captainId: number; upcomingByTeam: Record<string, any[]> | undefined; dim?: boolean }) {
   return (
     <div>
       <div className="text-[9px] font-heading uppercase tracking-[0.22em] text-white/45 mb-1">{label}</div>
       <div className="grid grid-cols-5 gap-1.5">
         {players.map((p) => {
           const logo = getTeamLogo(p.core.team);
           const isCaptain = p.core.id === captainId;
           const nextOpp = upcomingByTeam?.[p.core.team]?.[0];
           const inj = (p.core.injury ?? "").toString().toUpperCase();
           const hasRisk = inj && inj !== "—" && inj !== "PROBABLE";
           return (
             <div key={p.core.id} className={cn(
               "relative overflow-hidden rounded-lg border border-white/10 bg-black/35 px-2 py-2",
               dim && "opacity-80",
               isCaptain && "border-amber-300/60 ring-1 ring-amber-300/40",
             )}>
               {logo && <img src={logo} alt="" className="absolute -right-2 -bottom-2 w-12 h-12 object-contain opacity-[0.12] pointer-events-none" />}
               <div className="relative flex items-center gap-1.5">
                 {p.core.photo ? (
                   <img src={p.core.photo} alt="" className="w-7 h-7 rounded-full object-cover ring-1 ring-white/15" />
                 ) : (
                   <div className="w-7 h-7 rounded-full bg-white/[0.06] inline-flex items-center justify-center text-[9px] font-bold text-white/80">
                     {p.core.name.slice(0, 1)}
                   </div>
                 )}
                 {isCaptain && <Crown className="absolute -top-1 -left-1 h-3 w-3 text-amber-300 drop-shadow-[0_0_4px_rgba(252,211,77,0.8)]" />}
               </div>
               <div className="relative mt-1 text-[10px] font-heading font-bold uppercase tracking-[0.04em] text-white truncate">{p.core.name.split(" ").slice(-1)[0]}</div>
               <div className="relative flex items-center gap-1 mt-0.5 text-[9px] text-white/55">
                 <span className="font-mono text-amber-200">{Number(p.last5?.fp5 ?? 0).toFixed(1)}</span>
                 {nextOpp && <span className="truncate">· vs {nextOpp.opponent ?? "—"}</span>}
                 {hasRisk && <Heart className="h-2.5 w-2.5 text-rose-400 ml-auto" />}
               </div>
             </div>
           );
         })}
       </div>
     </div>
   );
 }