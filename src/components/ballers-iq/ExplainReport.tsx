import { Badge } from "@/components/ui/badge";
import {
  Activity, Disc, Users, Clock, Sparkles, Quote, Gauge, Flame, DollarSign, ShieldAlert,
  CalendarDays, Tag, Shield,
} from "lucide-react";
import { getTeamLogo, NBA_TEAMS } from "@/lib/nba-teams";
import { cn } from "@/lib/utils";

function getTeamFullName(tricode: string): string {
  const t = NBA_TEAMS.find((t) => t.tricode === tricode);
  return t?.name ?? tricode;
}

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
    case "very_high": return "bg-emerald-500 text-white border border-emerald-500";
    case "high":      return "bg-emerald-500/15 text-emerald-500 border border-emerald-500/40";
    case "medium":    return "bg-amber-500/15 text-amber-500 border border-amber-500/40";
    default:          return "bg-muted text-muted-foreground border border-border";
  }
}
function actionPalette(action: string) {
  switch ((action || "").toLowerCase()) {
    case "add":  return { chip: "bg-emerald-500 text-white", band: "bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent border-emerald-500/40", label: "ADD" };
    case "drop": return { chip: "bg-destructive text-destructive-foreground", band: "bg-gradient-to-r from-destructive/15 via-destructive/5 to-transparent border-destructive/40", label: "DROP" };
    default:     return { chip: "bg-amber-500 text-white", band: "bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/40", label: (action || "HOLD").toUpperCase() };
  }
}
function verdictPalette(verdict: string) {
  const v = (verdict || "").toUpperCase();
  switch (v) {
    case "START": return { chip: "bg-emerald-500 text-white", band: "border-emerald-500/40 bg-emerald-500/10", label: "START" };
    case "BENCH": return { chip: "bg-amber-500 text-white",   band: "border-amber-500/40 bg-amber-500/10",   label: "BENCH" };
    case "HOLD":  return { chip: "bg-sky-500 text-white",     band: "border-sky-500/40 bg-sky-500/10",       label: "HOLD" };
    case "WATCH": return { chip: "bg-violet-500 text-white",  band: "border-violet-500/40 bg-violet-500/10", label: "WATCH" };
    case "DROP":  return { chip: "bg-destructive text-destructive-foreground", band: "border-destructive/40 bg-destructive/10", label: "DROP" };
    default:      return { chip: "bg-muted text-muted-foreground", band: "border-border bg-muted/30", label: v || "—" };
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
    case "LOW":    return "bg-emerald-500/15 text-emerald-500 border border-emerald-500/40";
    case "MEDIUM": return "bg-amber-500/15 text-amber-500 border border-amber-500/40";
    case "HIGH":   return "bg-destructive/15 text-destructive border border-destructive/40";
    default:       return "bg-muted text-muted-foreground border border-border";
  }
}
function salaryClasses(label: string): string {
  switch ((label || "").toLowerCase()) {
    case "underpriced": return "bg-emerald-500/15 text-emerald-500 border border-emerald-500/40";
    case "fair value":  return "bg-muted text-muted-foreground border border-border";
    case "overpriced":  return "bg-amber-500/15 text-amber-500 border border-amber-500/40";
    case "salary trap": return "bg-destructive/15 text-destructive border border-destructive/40";
    default:            return "bg-muted text-muted-foreground border border-border";
  }
}
function scheduleClasses(label: string): string {
  switch ((label || "").toLowerCase()) {
    case "schedule boost": return "bg-emerald-500/15 text-emerald-500 border border-emerald-500/40";
    case "schedule drag":  return "bg-amber-500/15 text-amber-500 border border-amber-500/40";
    case "no game risk":   return "bg-destructive/15 text-destructive border border-destructive/40";
    default:               return "bg-muted text-muted-foreground border border-border";
  }
}
const RISK_FLAG_LABELS: Record<string, string> = {
  no_game: "No game scheduled",
  salary_inefficient: "Salary inefficient",
  injury_risk: "Injury risk",
  minutes_risk: "Minutes uncertain",
  cold_streak: "Cold streak",
  back_to_back: "Back-to-back",
  low_usage: "Low usage",
  blowout_risk: "Blowout risk",
  inconsistent: "Inconsistent output",
  foul_trouble: "Foul trouble prone",
  load_management: "Load management",
};
function humanizeFlag(flag: string): string {
  const key = (flag || "").toLowerCase().trim();
  if (RISK_FLAG_LABELS[key]) return RISK_FLAG_LABELS[key];
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ExplainReport({ result, player, onOpenPlayer, onOpenTeam }: { result: any; player: any; onOpenPlayer?: (id: number) => void; onOpenTeam?: (tricode: string) => void }) {
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
      {/* Player Spotlight Hero — broadcast card */}
      {player && (
        <div className="relative overflow-hidden rounded-2xl border border-amber-300/25 bg-gradient-to-br from-black/70 via-black/55 to-black/70 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,232,170,0.18),0_30px_80px_-30px_rgba(0,0,0,0.9)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
          {teamLogo && (
            <img src={teamLogo} alt="" aria-hidden className="absolute -right-6 -top-4 w-32 h-32 opacity-[0.10] pointer-events-none select-none" />
          )}
          <div className="relative grid md:grid-cols-12 gap-3 p-3 md:px-4 md:py-2.5 items-center">
            {/* LEFT — player */}
            <div className="md:col-span-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => player?.core?.id && onOpenPlayer?.(player.core.id)}
                className="shrink-0 transition-transform hover:scale-105"
                aria-label={`Open ${player.core?.name} profile`}
              >
                {player.core?.photo ? (
                  <img src={player.core.photo} alt="" className="w-14 h-14 rounded-xl object-cover object-[center_15%] bg-black/40 ring-2 ring-amber-300/60 shadow-[0_0_18px_-4px_rgba(252,211,77,0.5)]" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-white/[0.08] inline-flex items-center justify-center text-base font-bold text-white/85">
                    {player.core?.name?.slice(0, 2)?.toUpperCase()}
                  </div>
                )}
              </button>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => player?.core?.id && onOpenPlayer?.(player.core.id)}
                  className="font-heading font-black uppercase truncate text-base md:text-lg text-white tracking-[0.06em] drop-shadow-[0_0_18px_rgba(252,211,77,0.25)] leading-tight hover:text-amber-200 transition-colors text-left max-w-full block"
                >
                  {player.core?.name}
                </button>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {teamLogo && <img src={teamLogo} alt="" className="w-4 h-4" />}
                  <button
                    type="button"
                    onClick={() => teamTricode && onOpenTeam?.(teamTricode)}
                    className="text-[10.5px] text-white/65 truncate hover:text-amber-200 transition-colors"
                  >
                    {teamFullName} · {teamTricode}
                  </button>
                  <Badge variant={player.core?.fc_bc === "FC" ? "destructive" : "default"} className="rounded-md text-[8px] px-1 py-0 h-4">
                    {player.core?.fc_bc}
                  </Badge>
                </div>
                {(archetype || (formSignal && formSignal !== "Stable")) && (
                  <div className="mt-1 flex items-center gap-1 flex-wrap">
                    {archetype && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-heading font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/40">
                        <Tag className="h-2.5 w-2.5" /> {archetype}
                      </span>
                    )}
                    {formSignal && formSignal !== "Stable" && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-heading font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-500 border border-orange-500/40">
                        <Flame className="h-2.5 w-2.5" /> {formSignal}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT — 4 uniform stat cards: FP5 · FP Season · BIQ · Verdict */}
            <div className="md:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="rounded-lg border border-white/10 bg-black/45 px-2.5 py-2 flex flex-col items-center justify-center min-h-[58px]">
                <div className="text-[9px] font-heading uppercase tracking-[0.22em] text-amber-200/70">FP5</div>
                <div className="font-mono font-black text-lg text-amber-200 tabular-nums leading-tight mt-0.5">{fp5.toFixed(1)}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/45 px-2.5 py-2 flex flex-col items-center justify-center min-h-[58px]">
                <div className="text-[9px] font-heading uppercase tracking-[0.22em] text-white/60">FP Season</div>
                <div className="font-mono font-black text-lg text-white/95 tabular-nums leading-tight mt-0.5">{seasonFp.toFixed(1)}</div>
              </div>
              <div className="rounded-lg border border-amber-300/30 bg-amber-400/[0.06] px-2.5 py-2 flex flex-col items-center justify-center min-h-[58px]">
                <div className="text-[9px] font-heading uppercase tracking-[0.22em] text-amber-100/70 leading-tight">BIQ</div>
                {biqRating !== null ? (
                  <div className={`font-mono font-black text-lg tabular-nums leading-tight mt-0.5 ${biqRatingClasses(biqRating)}`}>{biqRating}<span className="text-[9px] text-white/45 font-heading ml-0.5">/100</span></div>
                ) : (
                  <div className="font-mono font-black text-lg text-white/40 tabular-nums leading-tight mt-0.5">—</div>
                )}
              </div>
              <div className={cn(
                "rounded-lg px-2.5 py-2 flex flex-col items-center justify-center min-h-[58px] border",
                vPalette ? "border-white/10 bg-black/45" : "border-white/10 bg-black/45",
              )}>
                <div className="text-[9px] font-heading uppercase tracking-[0.22em] text-white/60">Verdict</div>
                {vPalette ? (
                  <span className={`mt-1 inline-flex items-center justify-center font-heading font-black text-[11px] px-2.5 py-0.5 rounded-md ${vPalette.chip}`}>
                    {vPalette.label}
                  </span>
                ) : (
                  <span className="mt-1 font-heading text-[10px] uppercase tracking-[0.18em] text-white/55">Pending</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Salary + Risk + Schedule + Recommendation grid */}
      {(salaryEff || riskLevel || sched || result.recommendation) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
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
              {sched.next_game && <p className="text-[10px] font-mono mt-0.5 opacity-90">Next: {sched.next_game}</p>}
              {sched.warning && <p className="text-[10px] mt-0.5 opacity-90">{sched.warning}</p>}
            </div>
          )}
          {result.recommendation && (
            <div className={`rounded-xl px-3 py-2 border ${palette.band}`}>
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center justify-center font-heading font-black text-[10px] px-2 py-0.5 rounded-md ${palette.chip}`}>
                  {palette.label}
                </span>
                <span className="text-[9px] font-heading font-bold uppercase tracking-wider opacity-80">Verdict</span>
              </div>
              <p className="text-[11px] leading-snug text-white/90 mt-1 line-clamp-3">{result.recommendation.rationale}</p>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {result.summary && (
        <div className="rounded-xl border border-white/10 bg-black/45 backdrop-blur-xl p-3">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.22em] text-amber-100/75 mb-1.5">
            AI CoachCast{player?.core?.name ? ` · ${player.core.name}` : ""}
          </p>
          <div className="border-l-4 border-amber-300/70 pl-3 py-1 italic text-sm leading-relaxed text-white/90">
            <Quote className="h-3 w-3 inline mr-1 text-amber-300 -mt-1" />
            {result.summary}
          </div>
        </div>
      )}

      {/* Why it scores */}
      {result.why_it_scores?.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-black/45 backdrop-blur-xl p-3">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.22em] text-amber-100/75 mb-2">
            Scoring Drivers
          </p>
          <div className="rounded-lg divide-y divide-white/5 bg-black/30 border border-white/8">
            {result.why_it_scores.map((f: any, i: number) => {
              const Icon = factorIcon(f.factor);
              return (
                <div key={i} className="px-3 py-2 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-amber-300/80 shrink-0" />
                    <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-white/90">{f.factor}</span>
                    <span className={`ml-auto text-[9px] font-heading font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${impactClasses(f.impact)}`}>
                      {(f.impact || "").replace("_", " ")}
                    </span>
                  </div>
                  {f.note && <p className="text-xs text-white/65 leading-snug pl-5">{f.note}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}