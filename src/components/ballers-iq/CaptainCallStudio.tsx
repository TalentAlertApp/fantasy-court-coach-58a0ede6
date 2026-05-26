import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Crown, Loader2, Activity, Gauge, Sparkles, Heart, CalendarDays, ShieldAlert,
  TrendingUp, Flame, Users, Target, Radar, Trophy, BarChart3, ArrowLeftRight,
  CheckCircle2, Quote, Mic, Star,
} from "lucide-react";
import { getTeamLogo, NBA_TEAMS } from "@/lib/nba-teams";

function getTeamFullName(t: string): string {
  const x = NBA_TEAMS.find((n) => n.tricode === t);
  return x?.name ?? t;
}

type Props = {
  rosterData: any;
  allPlayers: any[];
  upcomingByTeam: Record<string, any[]> | undefined;
  captainLoading: boolean;
  captainResult: any;
  applyingCaptain: boolean;
  onPickCaptain: () => void;
  onApplyCaptain: () => void;
  onGoToTab: (tab: string) => void;
  onOpenPlayer?: (p: any) => void;
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
      <Icon className="h-3.5 w-3.5" />{children}
    </div>
  );
}

const CHECKS = [
  { icon: TrendingUp,  label: "Projected FP" },
  { icon: Flame,       label: "Ceiling" },
  { icon: Gauge,       label: "Floor" },
  { icon: Target,      label: "Matchup" },
  { icon: Activity,    label: "Usage" },
  { icon: Users,       label: "Minutes Security" },
  { icon: Heart,       label: "Health Risk" },
  { icon: Crown,       label: "Captain Edge" },
];

const LOADING_STEPS = [
  { icon: TrendingUp,  label: "Checking projected FP" },
  { icon: Flame,       label: "Measuring ceiling" },
  { icon: Target,      label: "Reading matchup" },
  { icon: Heart,       label: "Scanning health risk" },
  { icon: Crown,       label: "Comparing captain edge" },
  { icon: BarChart3,   label: "Ranking alternatives" },
];

function reasonIcon(line: string) {
  const f = (line || "").toLowerCase();
  if (f.includes("matchup") || f.includes("opp")) return Target;
  if (f.includes("minute") || f.includes("mpg")) return Users;
  if (f.includes("injur") || f.includes("health") || f.includes("risk")) return Heart;
  if (f.includes("schedule") || f.includes("b2b") || f.includes("game")) return CalendarDays;
  if (f.includes("usage") || f.includes("role")) return Activity;
  if (f.includes("form") || f.includes("fp") || f.includes("edge")) return Flame;
  return Sparkles;
}

export default function CaptainCallStudio({
  rosterData, allPlayers, upcomingByTeam,
  captainLoading, captainResult, applyingCaptain,
  onPickCaptain, onApplyCaptain, onGoToTab, onOpenPlayer,
}: Props) {

  /* ---------- roster snapshot ---------- */
  const snapshot = useMemo(() => {
    const r = rosterData?.roster;
    const starters: number[] = r?.starters ?? [];
    const captainId = Number(r?.captain_id ?? 0);
    const starterPlayers = starters
      .map((id) => allPlayers.find((p: any) => p.core.id === id))
      .filter(Boolean) as any[];
    const captainPlayer = captainId ? allPlayers.find((p: any) => p.core.id === captainId) : null;
    return { starters, starterPlayers, captainId, captainPlayer };
  }, [rosterData, allPlayers]);

  const candidates = useMemo(() => {
    return [...snapshot.starterPlayers].sort(
      (a, b) => (b.last5?.fp5 ?? 0) - (a.last5?.fp5 ?? 0),
    );
  }, [snapshot.starterPlayers]);

  const recommended = useMemo(() => {
    if (!captainResult?.captain_id) return null;
    return allPlayers.find((p: any) => p.core.id === captainResult.captain_id) ?? null;
  }, [captainResult, allPlayers]);

  const isAlreadyApplied = recommended && snapshot.captainId === recommended.core.id;

  /* ============ LOADING ============ */
  if (captainLoading) {
    return (
      <div className="space-y-3">
        <GlassPanel className="p-5">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <div className="absolute inset-0 rounded-full border border-amber-400/40 animate-ping" />
              <div className="absolute inset-2 rounded-full border border-amber-400/30 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Crown className="h-10 w-10 text-amber-300 drop-shadow-[0_0_18px_rgba(252,211,77,0.7)]" />
              </div>
              <div className="absolute inset-0 rounded-full [background:conic-gradient(from_0deg,transparent,rgba(252,211,77,0.3),transparent_55%)] animate-spin" style={{ animationDuration: "3s" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-heading uppercase tracking-[0.22em] text-amber-100/80">Analyzing Captain Edge</div>
              <div className="font-heading text-xl uppercase tracking-[0.12em] text-white truncate mt-1">CoachCast in progress…</div>
              <div className="text-[11px] text-white/55 mt-1 inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Scanning form, matchup, minutes and ceiling
              </div>
            </div>
          </div>
        </GlassPanel>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
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

  /* ============ RESULT ============ */
  if (captainResult && recommended) {
    const confidencePct = Math.round((Number(captainResult.confidence) || 0) * 100);
    const reasons: string[] = Array.isArray(captainResult.reason_bullets) ? captainResult.reason_bullets : [];
    const teamTri = recommended.core?.team;
    const teamLogo = teamTri ? getTeamLogo(teamTri) : null;
    const teamFull = teamTri ? getTeamFullName(teamTri) : "";
    const nextOpp = upcomingByTeam?.[teamTri]?.[0];
    const fp5 = Number(recommended.last5?.fp5 ?? 0);
    const captainFp = fp5 * 2;
    const injury = (recommended.core?.injury ?? "").toString().toUpperCase();
    const healthRisky = injury && injury !== "—" && injury !== "PROBABLE" && injury !== "ACTIVE";

    return (
      <div className="space-y-3">
        {/* HERO — CoachCast verdict */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-300/30 bg-gradient-to-br from-black/70 via-black/55 to-black/70 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,232,170,0.18),0_30px_80px_-30px_rgba(0,0,0,0.9)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
          {teamLogo && (
            <img src={teamLogo} alt="" aria-hidden className="absolute -right-6 -top-4 w-36 h-36 opacity-[0.10] pointer-events-none select-none" />
          )}
          <div className="relative grid md:grid-cols-12 gap-4 px-4 py-3">
            {/* LEFT — recommendation */}
            <div className="md:col-span-8 min-w-0 flex items-center gap-3">
              {recommended.core?.photo ? (
                <img src={recommended.core.photo} alt="" className="w-16 h-16 rounded-xl object-cover object-[center_15%] bg-black/40 ring-2 ring-amber-300/60 shadow-[0_0_18px_-4px_rgba(252,211,77,0.6)]" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-white/[0.08] inline-flex items-center justify-center font-bold text-white/85">
                  {recommended.core?.name?.slice(0, 2)?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-heading uppercase tracking-[0.22em] text-amber-100/75 inline-flex items-center gap-1.5">
                  <Mic className="h-3 w-3" /> CoachCast — Best Captain Today
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <Crown className="h-5 w-5 text-amber-300 drop-shadow-[0_0_8px_rgba(252,211,77,0.7)]" />
                  <span className="font-heading font-black uppercase text-lg md:text-xl text-white tracking-[0.04em] drop-shadow-[0_0_18px_rgba(252,211,77,0.25)] leading-tight truncate">
                    Go with {recommended.core?.name}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-white/65">
                  {teamLogo && <img src={teamLogo} alt="" className="w-4 h-4" />}
                  <span className="truncate">{teamFull} · {teamTri}</span>
                  <span className={cn(
                    "ml-1 rounded-md px-1.5 py-0 text-[9px] font-heading uppercase tracking-wider border",
                    recommended.core?.fc_bc === "FC" ? "border-red-400/40 text-red-200 bg-red-500/10" : "border-sky-400/40 text-sky-200 bg-sky-500/10",
                  )}>{recommended.core?.fc_bc}</span>
                </div>
                {reasons[0] && <p className="mt-1.5 text-[12px] text-white/85 leading-snug line-clamp-2">{reasons[0]}</p>}
              </div>
            </div>
            {/* RIGHT — confidence + apply */}
            <div className="md:col-span-4 grid grid-cols-2 gap-2 self-center">
              <div className="rounded-lg border border-amber-300/30 bg-amber-400/[0.06] px-2.5 py-2 flex flex-col items-center justify-center">
                <div className="text-[9px] font-heading uppercase tracking-[0.22em] text-amber-100/75">Confidence</div>
                <div className="font-mono font-black text-2xl text-amber-200 tabular-nums leading-tight mt-0.5">{confidencePct}<span className="text-sm text-white/45 ml-0.5">%</span></div>
              </div>
              <div className="flex flex-col gap-1.5">
                {isAlreadyApplied ? (
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2 text-center font-heading font-black text-[11px] uppercase tracking-[0.18em] text-emerald-200 inline-flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Captain Active
                  </div>
                ) : (
                  <Button
                    onClick={onApplyCaptain}
                    disabled={applyingCaptain}
                    className="font-heading uppercase tracking-[0.18em] bg-gradient-to-b from-amber-300 to-amber-500 text-black hover:from-amber-200 hover:to-amber-400 shadow-[0_0_28px_-6px_rgba(252,211,77,0.7)]"
                  >
                    {applyingCaptain ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Crown className="h-3.5 w-3.5 mr-1" /> Apply Captain</>}
                  </Button>
                )}
                <button
                  onClick={onPickCaptain}
                  className="text-[10px] font-heading uppercase tracking-[0.18em] text-white/55 hover:text-white border border-white/10 rounded-md py-1"
                >
                  <Activity className="h-3 w-3 inline mr-1" /> Re-run
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MULTIPLIER + KEY DRIVERS */}
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-3">
            {/* Multiplier Impact */}
            <GlassPanel className="p-4">
              <SectionLabel icon={Sparkles}>Multiplier Impact</SectionLabel>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat label="Base FP" value={fp5.toFixed(1)} />
                <Stat label="Captain FP" value={captainFp.toFixed(1)} tone="good" />
                <Stat label="Gain" value={`+${fp5.toFixed(1)}`} tone="good" />
                <Stat label="Multiplier" value="2x" />
              </div>
            </GlassPanel>

            {/* Key Drivers (reason bullets) */}
            {reasons.length > 0 && (
              <GlassPanel className="p-4">
                <SectionLabel icon={Radar}>Key Drivers</SectionLabel>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {reasons.map((r, i) => {
                    const Icon = reasonIcon(r);
                    return (
                      <div key={i} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white/85 leading-snug flex gap-2">
                        <Icon className="h-3.5 w-3.5 text-amber-300/85 shrink-0 mt-0.5" /> {r}
                      </div>
                    );
                  })}
                </div>
              </GlassPanel>
            )}

            {/* Roster Candidates */}
            {candidates.length > 0 && (
              <GlassPanel className="p-4">
                <SectionLabel icon={Trophy}>Roster Candidates</SectionLabel>
                <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
                  {candidates.slice(0, 5).map((p, i) => {
                    const logo = getTeamLogo(p.core.team);
                    const isReco = p.core.id === recommended.core.id;
                    const opp = upcomingByTeam?.[p.core.team]?.[0];
                    const inj = (p.core.injury ?? "").toString().toUpperCase();
                    const hasRisk = inj && inj !== "—" && inj !== "PROBABLE" && inj !== "ACTIVE";
                    return (
                      <button
                        key={p.core.id}
                        onClick={() => onOpenPlayer?.(p)}
                        className={cn(
                          "relative overflow-hidden rounded-lg border bg-black/35 px-2 py-2 text-left transition-all hover:-translate-y-0.5 hover:brightness-125",
                          isReco ? "border-amber-300/60 ring-1 ring-amber-300/40 bg-amber-400/[0.06]" : "border-white/10",
                        )}
                      >
                        {logo && <img src={logo} alt="" className="absolute -right-2 -bottom-2 w-12 h-12 object-contain opacity-[0.12] pointer-events-none" />}
                        <div className="relative flex items-center gap-1.5">
                          {p.core.photo ? (
                            <img src={p.core.photo} alt="" className={cn("w-8 h-8 rounded-full object-cover ring-1", isReco ? "ring-amber-300/70" : "ring-white/15")} />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-white/[0.06] inline-flex items-center justify-center text-[10px] font-bold text-white/80">{p.core.name.slice(0, 1)}</div>
                          )}
                          <span className="text-[9px] font-heading uppercase tracking-[0.18em] text-white/45 ml-auto">#{i + 1}</span>
                        </div>
                        <div className="relative mt-1 text-[10.5px] font-heading font-bold uppercase tracking-[0.04em] text-white truncate">{p.core.name}</div>
                        <div className="relative flex items-center gap-1 mt-0.5 text-[9.5px] text-white/55">
                          <span className="font-mono text-amber-200">{Number(p.last5?.fp5 ?? 0).toFixed(1)}</span>
                          {opp && <span className="truncate">· vs {opp.opponent ?? "—"}</span>}
                          {hasRisk && <Heart className="h-2.5 w-2.5 text-rose-400 ml-auto" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[9.5px] uppercase tracking-[0.18em] text-white/40">Roster candidates · sorted by FP5</p>
              </GlassPanel>
            )}
          </div>

          {/* RIGHT — Captain Radar */}
          <div className="lg:col-span-4 flex flex-col">
            <GlassPanel className="p-4 flex-1 flex flex-col">
              <SectionLabel icon={Radar}>Captain Radar</SectionLabel>
              <div className="mt-3 space-y-2 flex-1">
                <Signal icon={Crown} title="Captain Edge" chip={`${confidencePct}%`} tone={confidencePct >= 70 ? "good" : confidencePct >= 50 ? "warn" : "bad"} note={reasons[0] ?? "AI captain pick"} />
                <Signal icon={Flame} title="High Ceiling" chip={fp5 >= 35 ? "Elite" : fp5 >= 25 ? "Solid" : "Modest"} tone={fp5 >= 30 ? "good" : "warn"} note={`FP5 ${fp5.toFixed(1)}`} />
                <Signal icon={Users} title="Minutes" chip={Number(recommended.last5?.mpg5 ?? 0) >= 30 ? "Heavy" : "Watch"} tone={Number(recommended.last5?.mpg5 ?? 0) >= 30 ? "good" : "warn"} note={`${Number(recommended.last5?.mpg5 ?? 0).toFixed(1)} MPG5`} />
                <Signal icon={Heart} title="Health" chip={healthRisky ? injury : "Clear"} tone={healthRisky ? "bad" : "good"} note={healthRisky ? "Open Health Desk for status." : "No injury flags."} />
                <Signal icon={CalendarDays} title="Next Game" chip={nextOpp ? "Has game" : "No game"} tone={nextOpp ? "good" : "bad"} note={nextOpp ? `vs ${nextOpp.opponent ?? "—"}` : "No scheduled games."} />
              </div>
            </GlassPanel>
          </div>
        </div>
      </div>
    );
  }

  /* ============ PRE-PICK ============ */
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-12">
        {/* LEFT — Hero */}
        <GlassPanel className="md:col-span-5 p-5 md:p-6">
          <SectionLabel icon={Crown}>Captain Call</SectionLabel>
          <h3 className="mt-3 font-heading text-2xl md:text-3xl uppercase tracking-[0.14em] text-white leading-tight">
            Multiplier <span className="text-amber-300">Intelligence</span>
          </h3>
          <p className="mt-2 text-[12.5px] text-white/65 leading-relaxed">
            Find the best captain multiplier based on form, matchup, schedule, risk and projected fantasy edge.
          </p>
          <Button
            size="lg"
            onClick={onPickCaptain}
            className="mt-5 w-full font-heading uppercase tracking-[0.18em] bg-gradient-to-b from-amber-300 to-amber-500 text-black hover:from-amber-200 hover:to-amber-400 shadow-[0_0_28px_-6px_rgba(252,211,77,0.7)]"
          >
            <Crown className="h-4 w-4 mr-2" /> Best Captain Today
          </Button>
          <p className="mt-2 text-[10.5px] text-white/45 leading-snug">
            Uses your current starters, bench, gameweek, schedule context and player form.
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

        {/* RIGHT — Current Captain Snapshot */}
        <GlassPanel className="md:col-span-3 p-5">
          <SectionLabel icon={Gauge}>Current Captain</SectionLabel>
          {snapshot.captainPlayer ? (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                {snapshot.captainPlayer.core?.photo ? (
                  <img src={snapshot.captainPlayer.core.photo} alt="" className="w-10 h-10 rounded-lg object-cover ring-1 ring-amber-300/60" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white/[0.06] inline-flex items-center justify-center text-[11px] font-bold text-white/80">
                    {snapshot.captainPlayer.core.name.slice(0, 2)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-heading font-bold text-[12px] uppercase text-white truncate">{snapshot.captainPlayer.core.name}</div>
                  <div className="text-[10px] text-white/55 truncate">{snapshot.captainPlayer.core.team} · FP5 {Number(snapshot.captainPlayer.last5?.fp5 ?? 0).toFixed(1)}</div>
                </div>
              </div>
              {(() => {
                const opp = upcomingByTeam?.[snapshot.captainPlayer.core.team]?.[0];
                const inj = (snapshot.captainPlayer.core.injury ?? "").toString().toUpperCase();
                const risky = inj && inj !== "—" && inj !== "PROBABLE" && inj !== "ACTIVE";
                return (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md border border-amber-300/40 bg-amber-400/[0.06] text-[9.5px] font-heading uppercase tracking-wider text-amber-100">2x Active</span>
                    {risky && <span className="px-2 py-0.5 rounded-md border border-rose-400/40 bg-rose-500/10 text-[9.5px] font-heading uppercase tracking-wider text-rose-100">{inj}</span>}
                    {opp ? (
                      <span className="px-2 py-0.5 rounded-md border border-white/15 bg-white/[0.04] text-[9.5px] font-heading uppercase tracking-wider text-white/75">vs {opp.opponent ?? "—"}</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md border border-rose-400/40 bg-rose-500/10 text-[9.5px] font-heading uppercase tracking-wider text-rose-100">No Game</span>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="mt-3">
              <div className="font-heading font-black text-[12px] uppercase tracking-[0.1em] text-white">No active captain selected</div>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-amber-400/40 bg-amber-400/[0.10] text-[10px] font-heading uppercase tracking-[0.16em] text-amber-100">
                <Crown className="h-3 w-3" /> 2x FP Opportunity Missing
              </div>
            </div>
          )}
        </GlassPanel>
      </div>

      {/* BOTTOM — Candidate strip */}
      {candidates.length > 0 && (
        <GlassPanel className="p-4">
          <SectionLabel icon={Trophy}>Captain Candidates</SectionLabel>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
            {candidates.slice(0, 5).map((p) => {
              const logo = getTeamLogo(p.core.team);
              const opp = upcomingByTeam?.[p.core.team]?.[0];
              const inj = (p.core.injury ?? "").toString().toUpperCase();
              const risky = inj && inj !== "—" && inj !== "PROBABLE" && inj !== "ACTIVE";
              return (
                <button
                  key={p.core.id}
                  onClick={() => onOpenPlayer?.(p)}
                  className="relative overflow-hidden rounded-lg border border-white/10 bg-black/35 px-2 py-2 text-left transition-all hover:-translate-y-0.5 hover:brightness-125 hover:border-amber-300/40"
                >
                  {logo && <img src={logo} alt="" className="absolute -right-2 -bottom-2 w-12 h-12 object-contain opacity-[0.12] pointer-events-none" />}
                  <div className="relative flex items-center gap-1.5">
                    {p.core.photo ? (
                      <img src={p.core.photo} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-white/15" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/[0.06] inline-flex items-center justify-center text-[10px] font-bold text-white/80">{p.core.name.slice(0, 1)}</div>
                    )}
                    <span className={cn(
                      "text-[9px] font-heading uppercase tracking-[0.16em] ml-auto px-1.5 py-0.5 rounded-md border",
                      p.core.fc_bc === "FC" ? "border-red-400/40 text-red-200 bg-red-500/10" : "border-sky-400/40 text-sky-200 bg-sky-500/10",
                    )}>{p.core.fc_bc}</span>
                  </div>
                  <div className="relative mt-1 text-[10.5px] font-heading font-bold uppercase tracking-[0.04em] text-white truncate">{p.core.name}</div>
                  <div className="relative flex items-center gap-1 mt-0.5 text-[9.5px] text-white/55">
                    <span className="font-mono text-amber-200">{Number(p.last5?.fp5 ?? 0).toFixed(1)}</span>
                    <span className="font-mono text-white/40">· ${Number(p.core?.salary ?? 0).toFixed(1)}M</span>
                    {opp && <span className="truncate ml-auto">vs {opp.opponent ?? "—"}</span>}
                    {risky && <Heart className="h-2.5 w-2.5 text-rose-400" />}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[9.5px] uppercase tracking-[0.18em] text-white/40">Preview candidates · AI pick after you tap Best Captain Today</p>
        </GlassPanel>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */
function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "bad" }) {
  const valCls = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : "text-white/95";
  return (
    <div className="rounded-lg border border-white/10 bg-black/45 px-2.5 py-2 flex flex-col items-center justify-center">
      <div className="text-[9px] font-heading uppercase tracking-[0.2em] text-white/55">{label}</div>
      <div className={cn("font-mono font-black text-lg tabular-nums leading-tight mt-0.5", valCls)}>{value}</div>
    </div>
  );
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