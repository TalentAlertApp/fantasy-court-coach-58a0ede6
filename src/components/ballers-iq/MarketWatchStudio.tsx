import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeftRight, Loader2, Sparkles, TrendingUp, TrendingDown, AlertTriangle,
  DollarSign, CalendarDays, Repeat, Activity, Radar, Mic, Flame,
  CheckCircle2, ShieldAlert, Zap, BarChart3, Target,
} from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import BallersIQMarketWatch from "./BallersIQMarketWatch";
import BringInModal from "@/components/acquisition/BringInModal";

type Props = {
  rosterData: any;
  allPlayers: any[];
  upcomingByTeam: Record<string, any[]> | undefined;
  transfersLoading: boolean;
  transfersResult: any;
  simResults: Record<number, any>;
  simulatingIdx: number | null;
  committingIdx: number | null;
  onSuggest: () => void;
  onSimulate: (idx: number, move: any) => void;
  onCommit: (idx: number, move: any) => void;
  onOpenPlayer?: (p: any) => void;
  onGoToTab: (t: string) => void;
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

function SectionLabel({ icon: Icon, children, accent = "amber" }:
  { icon: any; children: React.ReactNode; accent?: "amber" | "sky" | "rose" | "emerald" }) {
  const color = accent === "sky" ? "text-sky-200/85"
    : accent === "rose" ? "text-rose-200/85"
    : accent === "emerald" ? "text-emerald-200/85"
    : "text-amber-100/85";
  return (
    <div className={cn("flex items-center gap-2 text-[10px] font-heading font-bold uppercase tracking-[0.22em]", color)}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </div>
  );
}

function Stat({ label, value, tone = "default" }:
  { label: string; value: string; tone?: "default" | "good" | "bad" | "amber" }) {
  const valCls = tone === "good" ? "text-emerald-300"
    : tone === "bad" ? "text-rose-300"
    : tone === "amber" ? "text-amber-200"
    : "text-white/95";
  return (
    <div className="rounded-lg border border-white/10 bg-black/45 px-2.5 py-2 flex flex-col items-center justify-center">
      <div className="text-[9px] font-heading uppercase tracking-[0.2em] text-white/55">{label}</div>
      <div className={cn("font-mono font-black text-lg tabular-nums leading-tight mt-0.5", valCls)}>{value}</div>
    </div>
  );
}

function Signal({ icon: Icon, title, chip, tone, note }:
  { icon: any; title: string; chip: string; tone: "good" | "warn" | "bad" | "default"; note: string }) {
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

const LOADING_STEPS = [
  { icon: DollarSign,   label: "Checking affordable players" },
  { icon: TrendingUp,   label: "Comparing FP5 upside" },
  { icon: CalendarDays, label: "Reading schedule streams" },
  { icon: AlertTriangle,label: "Detecting salary traps" },
  { icon: Activity,     label: "Simulating roster balance" },
  { icon: BarChart3,    label: "Ranking transfer moves" },
];

const num = (v: unknown, d = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : d;
};

const RISK_FLAG_LABEL: Record<string, string> = {
  no_game: "No game this week",
  bench_only: "Bench only",
  injury: "Injury risk",
  injured: "Injury risk",
  salary_drop: "Salary drop risk",
  low_minutes: "Low minutes",
  same_team_cap: "Team cap reached",
  limited_sample: "Limited sample",
};
function prettyFlag(key: string): string {
  if (RISK_FLAG_LABEL[key]) return RISK_FLAG_LABEL[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function uniqFlags(arr: string[] | undefined): string[] {
  if (!Array.isArray(arr)) return [];
  return Array.from(new Set(arr.filter(Boolean)));
}

export default function MarketWatchStudio({
  rosterData, allPlayers, upcomingByTeam,
  transfersLoading, transfersResult, simResults, simulatingIdx, committingIdx,
  onSuggest, onSimulate, onCommit, onOpenPlayer, onGoToTab,
}: Props) {
  /* ----- Bring In planner (stages only, never commits) ----- */
  const [bringInPlayerId, setBringInPlayerId] = useState<number | null>(null);
  const [bringInOpen, setBringInOpen] = useState(false);
  const openBringIn = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setBringInPlayerId(id);
    setBringInOpen(true);
  };
  const bringInModal = (
    <BringInModal open={bringInOpen} onOpenChange={setBringInOpen} targetPlayerId={bringInPlayerId} />
  );

  /* ----- derive market / roster pools (mirrors AICoachModal) ----- */
  const pools = useMemo(() => {
    const rosterIds = new Set<number>([
      ...(rosterData?.roster?.starters ?? []),
      ...(rosterData?.roster?.bench ?? []),
    ].filter(Boolean));
    const toMP = (p: any) => ({
      id: p.core.id, name: p.core.name, team: p.core.team, fc_bc: p.core.fc_bc,
      salary: p.core.salary, fp_pg5: p.last5?.fp5, fp_pg_t: p.season?.fp,
      value5: p.last5?.value5, delta_fp: p.last5?.delta_fp, delta_mpg: p.last5?.delta_mpg,
      injury: p.core?.injury, photo: p.core?.photo,
    });
    const market = allPlayers.filter((p: any) => !rosterIds.has(p.core.id)).map(toMP);
    const rosterPlayers = allPlayers.filter((p: any) => rosterIds.has(p.core.id)).map(toMP);
    const bank = num(rosterData?.roster?.bank_remaining);
    const todayLisbon = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const todayTeams = upcomingByTeam
      ? Object.entries(upcomingByTeam).filter(([, g]) => g.some((x: any) => x.date === todayLisbon)).map(([t]) => t)
      : [];
    return { market, rosterPlayers, bank, todayTeams, rosterIds };
  }, [rosterData, allPlayers, upcomingByTeam]);

  /* ----- market pulse metrics ----- */
  const pulse = useMemo(() => {
    const { market, rosterPlayers, bank, todayTeams } = pools;
    const affordable = market.filter((p) => num(p.salary) <= bank + 0.01).length;
    const todaySet = new Set(todayTeams);
    const valueAdds = market.filter((p) => num(p.salary) <= bank + 0.01 && num(p.salary) > 0 && num(p.fp_pg5) > 0).length;
    const traps = market.filter((p) => num(p.salary) >= 8 && num(p.value5) > 0 && num(p.value5) < 1.6).length;
    const streams = market.filter((p) => p.team && todaySet.has(p.team) && num(p.fp_pg5) >= 15).length;
    const dropRisks = rosterPlayers.filter((p) => {
      const inj = (p.injury ?? "").toString().toUpperCase();
      const hurt = inj && inj !== "—" && inj !== "PROBABLE" && inj !== "ACTIVE";
      return hurt || num(p.delta_fp) < -3 || num(p.delta_mpg) < -4;
    }).length;
    // Best swap
    let bestSwap: any = null;
    if (rosterPlayers.length) {
      const list: any[] = [];
      for (const out of rosterPlayers) {
        const cap = bank + num(out.salary);
        const same = market
          .filter((m) => m.fc_bc === out.fc_bc && num(m.salary) <= cap + 0.01 && num(m.fp_pg5) > num(out.fp_pg5))
          .sort((a, b) => num(b.fp_pg5) - num(a.fp_pg5))[0];
        if (same) list.push({ out, in: same, fpDelta: num(same.fp_pg5) - num(out.fp_pg5), salaryDelta: num(same.salary) - num(out.salary) });
      }
      bestSwap = list.sort((a, b) => b.fpDelta - a.fpDelta)[0] ?? null;
    }
    return { affordable, valueAdds, traps, streams, dropRisks, bestSwap };
  }, [pools]);

  const getPlayer = (id: number) => allPlayers.find((p: any) => p.core.id === id);
  const getPlayerName = (id: number) => getPlayer(id)?.core?.name ?? `#${id}`;

  /* ============ LOADING ============ */
  if (transfersLoading) {
    return (
      <div className="space-y-3">
        <GlassPanel className="p-5">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <div className="absolute inset-0 rounded-full border border-amber-400/40 animate-ping" />
              <div className="absolute inset-2 rounded-full border border-amber-400/30 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <ArrowLeftRight className="h-10 w-10 text-amber-300 drop-shadow-[0_0_18px_rgba(252,211,77,0.6)]" />
              </div>
              <div className="absolute inset-0 rounded-full [background:conic-gradient(from_0deg,transparent,rgba(252,211,77,0.25),transparent_55%)] animate-spin" style={{ animationDuration: "3s" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-heading uppercase tracking-[0.22em] text-amber-100/80">Scanning Transfer Market</div>
              <div className="font-heading text-xl uppercase tracking-[0.12em] text-white truncate mt-1">CoachCast in progress…</div>
              <div className="text-[11px] text-white/55 mt-1 inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Comparing form, schedule, salary and roster balance
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

  /* ============ RECOMMENDATIONS RESULT ============ */
  if (transfersResult?.moves?.length) {
    const moves = transfersResult.moves as any[];
    const top = moves[0];
    const addP = getPlayer(top.add);
    const dropP = getPlayer(top.drop);
    const conf = Math.round(num(top.confidence) * 100);
    const addLogo = addP?.core?.team ? getTeamLogo(addP.core.team) : null;
    const dropLogo = dropP?.core?.team ? getTeamLogo(dropP.core.team) : null;
    const reasons: string[] = top.reason_bullets ?? [];
    const riskFlags: string[] = top.risk_flags ?? [];
    const fpDelta = num(addP?.last5?.fp5) - num(dropP?.last5?.fp5);
    const salDelta = num(addP?.core?.salary) - num(dropP?.core?.salary);

    return (
      <div className="space-y-3">
        {/* HERO — best transfer move */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-300/30 bg-gradient-to-br from-black/70 via-black/55 to-black/70 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,232,170,0.18),0_30px_80px_-30px_rgba(0,0,0,0.9)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
          <div className="relative grid md:grid-cols-12 gap-4 px-4 py-3">
            <div className="md:col-span-8 min-w-0">
              <div className="text-[10px] font-heading uppercase tracking-[0.22em] text-amber-100/75 inline-flex items-center gap-1.5">
                <Mic className="h-3 w-3" /> CoachCast — Best Transfer Move
              </div>
              {/* swap composition */}
              <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                {/* DROP */}
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-2 flex items-center gap-2 min-w-0 relative overflow-hidden">
                  {dropLogo && <img src={dropLogo} alt="" className="absolute -right-3 -bottom-3 w-14 h-14 opacity-[0.12] pointer-events-none" />}
                  {dropP?.core?.photo ? (
                    <img src={dropP.core.photo} alt="" className="w-10 h-10 rounded-lg object-cover object-[center_15%] ring-1 ring-rose-300/50" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/[0.06] inline-flex items-center justify-center text-[10px] font-bold text-white/80">{(dropP?.core?.name ?? "?").slice(0, 1)}</div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[8.5px] font-heading uppercase tracking-[0.2em] text-rose-200/85">Drop</div>
                    <div className="text-[11.5px] font-heading font-bold uppercase text-white truncate">{dropP?.core?.name ?? `#${top.drop}`}</div>
                    <div className="text-[9.5px] text-white/55 truncate">{dropP?.core?.team} · ${num(dropP?.core?.salary).toFixed(1)}M</div>
                  </div>
                </div>
                {/* arrow */}
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border",
                  fpDelta >= 0 ? "border-emerald-400/50 bg-emerald-500/10 text-emerald-300" : "border-rose-400/50 bg-rose-500/10 text-rose-300",
                )}>
                  <ArrowLeftRight className="h-4 w-4" />
                </div>
                {/* ADD */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-2 flex items-center gap-2 min-w-0 relative overflow-hidden">
                  {addLogo && <img src={addLogo} alt="" className="absolute -right-3 -bottom-3 w-14 h-14 opacity-[0.12] pointer-events-none" />}
                  {addP?.core?.photo ? (
                    <img src={addP.core.photo} alt="" className="w-10 h-10 rounded-lg object-cover object-[center_15%] ring-1 ring-emerald-300/50" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/[0.06] inline-flex items-center justify-center text-[10px] font-bold text-white/80">{(addP?.core?.name ?? "?").slice(0, 1)}</div>
                  )}
                  <div className="min-w-0">
                    <div className="text-[8.5px] font-heading uppercase tracking-[0.2em] text-emerald-200/85">Add</div>
                    <div className="text-[11.5px] font-heading font-bold uppercase text-white truncate">{addP?.core?.name ?? `#${top.add}`}</div>
                    <div className="text-[9.5px] text-white/55 truncate">{addP?.core?.team} · ${num(addP?.core?.salary).toFixed(1)}M</div>
                  </div>
                  <button
                    type="button"
                    title="Bring In plan"
                    onClick={(e) => openBringIn(top.add, e)}
                    className="relative z-[1] ml-auto self-start inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-heading font-bold uppercase tracking-wider text-emerald-200 transition-colors hover:bg-emerald-500/20"
                  >
                    <Target className="h-3 w-3" /> Bring In
                  </button>
                </div>
              </div>
              {reasons[0] && <p className="mt-2 text-[12px] text-white/85 leading-snug line-clamp-2">{reasons[0]}</p>}
            </div>

            {/* RIGHT — metrics + actions */}
            <div className="md:col-span-4 flex flex-col gap-2 self-center">
              {/* Stats bar: Confidence | FP5 Gain */}
              <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-black/45 overflow-hidden divide-x divide-white/10">
                <div className="flex flex-col items-center justify-center py-2">
                  <div className="text-[9px] font-heading uppercase tracking-[0.2em] text-white/55">Confidence</div>
                  <div className="font-mono font-black text-lg tabular-nums leading-tight mt-0.5 text-amber-200">{conf}%</div>
                </div>
                <div className="flex flex-col items-center justify-center py-2">
                  <div className="text-[9px] font-heading uppercase tracking-[0.2em] text-white/55">FP5 Gain</div>
                  <div className={cn(
                    "font-mono font-black text-lg tabular-nums leading-tight mt-0.5",
                    fpDelta >= 0 ? "text-emerald-300" : "text-rose-300",
                  )}>
                    {fpDelta >= 0 ? "+" : ""}{fpDelta.toFixed(1)}
                  </div>
                </div>
              </div>
              {/* Actions bar: primary + small re-scan */}
              <div className="flex items-stretch gap-2">
                {!simResults[0] ? (
                  <Button size="sm" variant="outline" onClick={() => onSimulate(0, top)} disabled={simulatingIdx === 0}
                    className="flex-1 font-heading uppercase tracking-[0.16em] text-[11px] h-9">
                    {simulatingIdx === 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Activity className="h-3.5 w-3.5 mr-1" />} Simulate
                  </Button>
                ) : simResults[0].is_valid ? (
                  <Button size="sm" onClick={() => onCommit(0, top)} disabled={committingIdx === 0}
                    className="flex-1 font-heading uppercase tracking-[0.16em] text-[11px] h-9 bg-gradient-to-b from-emerald-400 to-emerald-600 text-white hover:from-emerald-300 hover:to-emerald-500">
                    {committingIdx === 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />} Commit Transfer
                  </Button>
                ) : (
                  <div className="flex-1 inline-flex items-center justify-center rounded-md border border-rose-500/40 bg-rose-500/10 px-2 text-[10px] text-rose-200 text-center h-9">
                    {simResults[0].errors?.join(", ") || "Invalid"}
                  </div>
                )}
                <button
                  onClick={onSuggest}
                  title="Re-scan market"
                  aria-label="Re-scan market"
                  className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-white/12 bg-black/40 text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <Activity className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE GRID — recommendations + signal rail */}
        <div className="grid gap-3 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-8 space-y-3">
            <GlassPanel className="p-4">
              <SectionLabel icon={Sparkles}>All Recommendations</SectionLabel>
              <div className="mt-3 space-y-2">
                {moves.map((m: any, idx: number) => {
                  const a = getPlayer(m.add);
                  const d = getPlayer(m.drop);
                  const c = Math.round(num(m.confidence) * 100);
                  const sim = simResults[idx];
                  return (
                    <div key={idx} className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-[10px] font-heading uppercase tracking-wider">
                          ADD {a?.core?.name ?? `#${m.add}`}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/40 text-rose-200 text-[10px] font-heading uppercase tracking-wider">
                          DROP {d?.core?.name ?? `#${m.drop}`}
                        </span>
                        <span className="ml-auto px-2 py-0.5 rounded-md border border-amber-300/40 bg-amber-400/[0.08] text-amber-200 text-[10px] font-heading uppercase tracking-wider">{c}%</span>
                      </div>
                      {m.reason_bullets?.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-[11px] text-white/75">
                          {m.reason_bullets.map((b: string, i: number) => (
                            <li key={i} className="flex gap-1.5"><Sparkles className="h-3 w-3 text-amber-300/80 shrink-0 mt-0.5" /> {b}</li>
                          ))}
                        </ul>
                      )}
                      {uniqFlags(m.risk_flags).length > 0 && (
                        <div className="mt-1.5 flex gap-1 flex-wrap">
                          {uniqFlags(m.risk_flags).map((f) => (
                            <span
                              key={f}
                              title={f}
                              className="text-[9.5px] px-1.5 py-0.5 rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-200 inline-flex items-center gap-1"
                            >
                              <AlertTriangle className="h-2.5 w-2.5" /> {prettyFlag(f)}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        {!sim ? (
                          <Button size="sm" variant="outline" onClick={() => onSimulate(idx, m)} disabled={simulatingIdx === idx}
                            className="h-7 text-[10.5px] font-heading uppercase tracking-[0.14em]">
                            {simulatingIdx === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : "Simulate"}
                          </Button>
                        ) : (
                          <>
                            <span className={cn("text-[10.5px] font-heading uppercase tracking-wider", sim.is_valid ? "text-emerald-300" : "text-rose-300")}>
                              {sim.is_valid ? "Valid" : sim.errors?.join(", ")}
                            </span>
                            {sim.is_valid && (
                              <Button size="sm" onClick={() => onCommit(idx, m)} disabled={committingIdx === idx}
                                className="h-7 text-[10.5px] font-heading uppercase tracking-[0.14em] bg-gradient-to-b from-emerald-400 to-emerald-600 text-white hover:from-emerald-300 hover:to-emerald-500">
                                {committingIdx === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : "Commit"}
                              </Button>
                            )}
                          </>
                        )}
                        <button onClick={() => a && onOpenPlayer?.(a)} className="ml-auto text-[10px] font-heading uppercase tracking-[0.14em] text-white/55 hover:text-white">
                          Explain Add
                        </button>
                        <button onClick={() => d && onOpenPlayer?.(d)} className="text-[10px] font-heading uppercase tracking-[0.14em] text-white/55 hover:text-white">
                          Explain Drop
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassPanel>
          </div>

          {/* RIGHT — Market Intel rail */}
          <div className="lg:col-span-4 flex flex-col">
            <GlassPanel className="p-4 flex-1 flex flex-col">
              <SectionLabel icon={Radar}>Market Intel</SectionLabel>
              <div className="mt-3 space-y-2 flex-1">
                <Signal icon={DollarSign} title="Bank" chip={`$${pools.bank.toFixed(1)}M`} tone={pools.bank > 5 ? "good" : pools.bank > 0 ? "warn" : "default"} note="Salary available for upgrades." />
                <Signal icon={Sparkles} title="Value Adds" chip={String(pulse.valueAdds)} tone={pulse.valueAdds > 0 ? "good" : "default"} note="Affordable upside targets." />
                <Signal icon={CalendarDays} title="Schedule Streams" chip={String(pulse.streams)} tone={pulse.streams > 0 ? "good" : "default"} note="Plays today with FP edge." />
                <Signal icon={AlertTriangle} title="Drop Risks" chip={String(pulse.dropRisks)} tone={pulse.dropRisks > 0 ? "warn" : "good"} note="Roster regression watch." />
                <Signal icon={ShieldAlert} title="Salary Traps" chip={String(pulse.traps)} tone={pulse.traps > 0 ? "warn" : "good"} note="Overpriced for value5." />
                <Signal icon={Zap} title="Market Heat" chip={pulse.affordable >= 50 ? "Hot" : "Cool"} tone={pulse.affordable >= 50 ? "good" : "default"} note={`${pulse.affordable} affordable players.`} />
              </div>
            </GlassPanel>
          </div>
        </div>

        {/* DETERMINISTIC MARKET WATCH BOARD — collapsible */}
        <details className="group">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center gap-2 text-[10px] font-heading uppercase tracking-[0.22em] text-amber-100/70 hover:text-amber-100 px-1 py-2">
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Deterministic Market Lanes</span>
              <span className="ml-auto text-white/40 group-open:rotate-180 transition-transform">▾</span>
            </div>
          </summary>
          <BallersIQMarketWatch
            market={pools.market}
            rosterPlayers={pools.rosterPlayers}
            bankRemaining={pools.bank}
            todayTeams={pools.todayTeams}
            className="sticky bottom-0 z-20"
            onPickPlayer={(id) => {
              const p = getPlayer(id);
              if (p) onOpenPlayer?.(p);
            }}
          />
        </details>
      </div>
    );
  }

  /* ============ PRE-SUGGESTION INTELLIGENCE STATE ============ */
  const bs = pulse.bestSwap;
  return (
    <div className="space-y-3">
      {/* HERO — Transfer Intelligence (L) | Market Pulse + Best Swap stacked (R) */}
      <div className="grid gap-3 md:grid-cols-12 items-stretch">
        <GlassPanel className="md:col-span-5 p-5 md:p-6 h-full flex flex-col">
          <SectionLabel icon={ArrowLeftRight}>Market Watch</SectionLabel>
          <h3 className="mt-3 font-heading text-2xl md:text-3xl uppercase tracking-[0.14em] text-white leading-tight">
            Transfer <span className="text-amber-300">Intelligence</span>
          </h3>
          <p className="mt-2 text-[12.5px] text-white/65 leading-relaxed">
            Find value adds, swap opportunities, schedule streams and salary traps before the market moves.
          </p>
          <Button
            size="lg"
            onClick={onSuggest}
            className="mt-auto w-full font-heading uppercase tracking-[0.18em] bg-gradient-to-b from-amber-300 to-amber-500 text-black hover:from-amber-200 hover:to-amber-400 shadow-[0_0_28px_-6px_rgba(252,211,77,0.7)]"
          >
            <ArrowLeftRight className="h-4 w-4 mr-2" /> Suggest Transfers
          </Button>
          <p className="mt-2 text-[10.5px] text-white/45 leading-snug">
            Uses your current roster, bank, salary cap, player form, schedule and positional balance.
          </p>
        </GlassPanel>

        {/* RIGHT COLUMN — Market Pulse (top) + Best Swap (bottom) */}
        <div className="md:col-span-7 flex flex-col gap-3 h-full">
          {/* MARKET PULSE */}
          <GlassPanel className="p-4">
            <SectionLabel icon={Activity}>Market Pulse</SectionLabel>
            <div className="mt-2 grid grid-cols-3 md:grid-cols-6 gap-1.5">
              <Stat label="Bank" value={`$${pools.bank.toFixed(1)}M`} tone={pools.bank > 0 ? "amber" : "default"} />
              <Stat label="Affordable" value={String(pulse.affordable)} />
              <Stat label="Value Adds" value={String(pulse.valueAdds)} tone={pulse.valueAdds > 0 ? "good" : "default"} />
              <Stat label="Streams" value={String(pulse.streams)} tone={pulse.streams > 0 ? "good" : "default"} />
              <Stat label="Drop Risks" value={String(pulse.dropRisks)} tone={pulse.dropRisks > 0 ? "bad" : "default"} />
              <Stat label="Traps" value={String(pulse.traps)} tone={pulse.traps > 0 ? "bad" : "default"} />
            </div>
          </GlassPanel>

          {/* BEST SWAP */}
          {bs ? (
            <div className="relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/[0.06] via-black/55 to-black/70 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(167,243,208,0.15),0_30px_80px_-30px_rgba(0,0,0,0.9)] flex-1 flex flex-col">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />
              <div className="relative flex flex-col gap-2 px-4 py-3 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-[10px] font-heading uppercase tracking-[0.22em] text-emerald-200/85 inline-flex items-center gap-1.5">
                    <Repeat className="h-3 w-3" /> Best Swap Available
                  </div>
                  <div className="text-[10.5px] text-white/55 ml-auto">Highest FP5 upgrade fitting cap & FC/BC balance.</div>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 flex-1">
                  <button onClick={() => { const p = getPlayer(bs.out.id); if (p) onOpenPlayer?.(p); }}
                    className="group relative overflow-hidden rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-2 text-left hover:bg-rose-500/[0.10] transition-colors h-full">
                    {bs.out.team && getTeamLogo(bs.out.team) && (
                      <img src={getTeamLogo(bs.out.team)!} alt="" className="pointer-events-none absolute -right-3 -top-3 w-16 h-16 object-contain opacity-[0.16] group-hover:opacity-40 group-hover:scale-125 transition-all" />
                    )}
                    <div className="relative flex items-center gap-2">
                      {bs.out.photo ? (
                        <img src={bs.out.photo} alt="" className="w-9 h-9 rounded-lg object-cover object-[center_15%] ring-1 ring-rose-300/50 shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-white/[0.06] inline-flex items-center justify-center text-[10px] font-bold text-white/80 shrink-0">{(bs.out.name ?? "?").slice(0, 1)}</div>
                      )}
                      <div className="min-w-0">
                        <div className="text-[8.5px] font-heading uppercase tracking-[0.2em] text-rose-200/85">Sell / Drop</div>
                        <div className="text-[12px] font-heading font-bold uppercase text-white truncate">{bs.out.name}</div>
                        <div className="text-[9.5px] text-white/55 truncate">{bs.out.team} · ${num(bs.out.salary).toFixed(1)}M · {num(bs.out.fp_pg5).toFixed(1)} FP5</div>
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border border-emerald-400/50 bg-emerald-500/10 text-emerald-300">
                    <ArrowLeftRight className="h-4 w-4" />
                  </div>
                  <button onClick={() => { const p = getPlayer(bs.in.id); if (p) onOpenPlayer?.(p); }}
                    className="group relative overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-2 text-left hover:bg-emerald-500/[0.10] transition-colors h-full">
                    {bs.in.team && getTeamLogo(bs.in.team) && (
                      <img src={getTeamLogo(bs.in.team)!} alt="" className="pointer-events-none absolute -right-3 -top-3 w-16 h-16 object-contain opacity-[0.16] group-hover:opacity-40 group-hover:scale-125 transition-all" />
                    )}
                    <div className="relative flex items-center gap-2">
                      {bs.in.photo ? (
                        <img src={bs.in.photo} alt="" className="w-9 h-9 rounded-lg object-cover object-[center_15%] ring-1 ring-emerald-300/50 shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-white/[0.06] inline-flex items-center justify-center text-[10px] font-bold text-white/80 shrink-0">{(bs.in.name ?? "?").slice(0, 1)}</div>
                      )}
                      <div className="min-w-0">
                        <div className="text-[8.5px] font-heading uppercase tracking-[0.2em] text-emerald-200/85">Buy / Add</div>
                        <div className="text-[12px] font-heading font-bold uppercase text-white truncate">{bs.in.name}</div>
                        <div className="text-[9.5px] text-white/55 truncate">{bs.in.team} · ${num(bs.in.salary).toFixed(1)}M · {num(bs.in.fp_pg5).toFixed(1)} FP5</div>
                      </div>
                    </div>
                  </button>
                  <div className="grid grid-rows-2 gap-1.5 h-full">
                    <Stat label="FP5 Δ" value={`+${bs.fpDelta.toFixed(1)}`} tone="good" />
                    <Stat label="Salary Δ" value={`${bs.salaryDelta >= 0 ? "+" : ""}$${bs.salaryDelta.toFixed(1)}M`} tone={bs.salaryDelta <= 0 ? "good" : "default"} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <GlassPanel className="p-4 flex-1 flex items-center">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-300/80" />
                <div>
                  <div className="font-heading uppercase tracking-[0.18em] text-[12px] text-white">No Clear Swap Edge Found</div>
                  <p className="text-[11px] text-white/60 mt-0.5">Your current roster does not show a high-confidence upgrade using the current bank.</p>
                </div>
              </div>
            </GlassPanel>
          )}
        </div>
      </div>

      {/* MARKET LANES — deterministic */}
      <BallersIQMarketWatch
        market={pools.market}
        rosterPlayers={pools.rosterPlayers}
        bankRemaining={pools.bank}
        todayTeams={pools.todayTeams}
        className="sticky bottom-0 z-20"
        onPickPlayer={(id) => {
          const p = getPlayer(id);
          if (p) onOpenPlayer?.(p);
        }}
      />

    </div>
  );
}