import {
  HeartPulse,
  Activity,
  ShieldAlert,
  Sparkles,
  Flame,
  Snowflake,
  CalendarCheck2,
  CalendarX2,
  CalendarClock,
  TrendingUp,
  TrendingDown,
  Crown,
  Puzzle,
  BadgeCheck,
  Star,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  isHealthUnavailable,
  isHealthRisky,
  getHealthLabel,
  getHealthTooltipText,
  type PlayerHealth,
} from "@/lib/health";

export type BadgeTone =
  | "red"
  | "rose"
  | "orange"
  | "amber"
  | "yellow"
  | "lime"
  | "green"
  | "teal"
  | "cyan"
  | "sky"
  | "indigo"
  | "gold"
  | "violet"
  | "slate";

export interface PlayerBadge {
  key: string;
  label: string;
  tone: BadgeTone;
  icon: LucideIcon;
  tooltip: string;
  priority: number;
}

export interface BadgePlayerInput {
  salary: number;
  fc_bc: "FC" | "BC";
  team: string;
  fpSeason: number;
  fpLast5: number;
  mpgSeason: number;
  mpgLast5: number;
  value: number;
  value5: number;
  health: PlayerHealth | null;
}

export interface BadgePoolStats {
  value5Q75: number;
  salaryMedian: number;
  fp5P90: number;
}

export interface BadgeCtx {
  pool: BadgePoolStats;
  upcoming?: { thisGw: number; next7: number } | null;
  isOwned?: boolean;
  isInWishlist?: boolean;
  rosterNeedsFc?: boolean;
  rosterNeedsBc?: boolean;
}

const safe = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
};

export function quantile(values: number[], q: number): number {
  const a = values.filter((v) => Number.isFinite(v) && v > 0).sort((x, y) => x - y);
  if (a.length === 0) return 0;
  const pos = (a.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return a[base + 1] !== undefined ? a[base] + rest * (a[base + 1] - a[base]) : a[base];
}

export function computePlayerBadges(p: BadgePlayerInput, ctx: BadgeCtx): PlayerBadge[] {
  const out: PlayerBadge[] = [];
  const fp = safe(p.fpSeason);
  const fp5 = safe(p.fpLast5);
  const mpg = safe(p.mpgSeason);
  const mpg5 = safe(p.mpgLast5);
  const v5 = safe(p.value5);
  const sal = safe(p.salary);

  // 1. Injury / Health
  if (p.health && (isHealthUnavailable(p.health) || isHealthRisky(p.health))) {
    const isOut = isHealthUnavailable(p.health);
    const lbl = (getHealthLabel(p.health) || (isOut ? "OUT" : "INJ"))
      .replace(/\s+/g, "")
      .toUpperCase()
      .slice(0, 6);
    out.push({
      key: "health",
      label: lbl,
      tone: isOut ? "red" : "amber",
      icon: isOut ? HeartPulse : Activity,
      tooltip: getHealthTooltipText(p.health) ?? "Health risk",
      priority: 1,
    });
  }

  // 2. Salary Trap
  const isExpensive = sal >= 6 && sal > ctx.pool.salaryMedian;
  const weakValue = v5 > 0 && ctx.pool.value5Q75 > 0 && v5 < ctx.pool.value5Q75 * 0.6;
  const declining =
    fp5 > 0 && fp > 0 && (fp5 <= fp - 5 || fp5 <= fp * 0.85);
  if (isExpensive && (weakValue || declining)) {
    out.push({
      key: "trap",
      label: "TRAP",
      tone: "rose",
      icon: ShieldAlert,
      tooltip: `Salary trap: $${sal}M with ${
        weakValue ? `weak value (V5 ${v5.toFixed(1)})` : `declining FP5 ${fp5.toFixed(1)} vs ${fp.toFixed(1)}`
      }.`,
      priority: 2,
    });
  }

  // 4. Value Add
  if (v5 > 0 && ctx.pool.value5Q75 > 0 && v5 >= ctx.pool.value5Q75 && sal > 0) {
    out.push({
      key: "value",
      label: "VALUE",
      tone: "green",
      icon: Sparkles,
      tooltip: `Value add: V5 ${v5.toFixed(1)} (pool top quartile ≥ ${ctx.pool.value5Q75.toFixed(1)}).`,
      priority: 4,
    });
  }

  // 5. Hot Form
  if (fp5 > 0 && fp > 0 && (fp5 >= fp + 5 || fp5 >= fp * 1.15)) {
    out.push({
      key: "hot",
      label: "HOT",
      tone: "orange",
      icon: Flame,
      tooltip: `Hot form: FP5 ${fp5.toFixed(1)} vs season ${fp.toFixed(1)}.`,
      priority: 5,
    });
  }

  // 6. Cold Form
  if (fp5 > 0 && fp > 0 && (fp5 <= fp - 5 || fp5 <= fp * 0.85)) {
    out.push({
      key: "cold",
      label: "COLD",
      tone: "cyan",
      icon: Snowflake,
      tooltip: `Cold form: FP5 ${fp5.toFixed(1)} vs season ${fp.toFixed(1)}.`,
      priority: 6,
    });
  }

  // 7 / 8. Schedule boost / drag
  if (ctx.upcoming) {
    const { thisGw, next7 } = ctx.upcoming;
    if (thisGw >= 2 || next7 >= 3) {
      out.push({
        key: "schedplus",
        label: "SCHED+",
        tone: "teal",
        icon: CalendarCheck2,
        tooltip: `Strong schedule: ${thisGw} this GW · ${next7} in next 7d.`,
        priority: 7,
      });
    } else if (thisGw === 0) {
      out.push({
        key: "nogame",
        label: "NO GAME",
        tone: "amber",
        icon: CalendarX2,
        tooltip: "No games scheduled in the current gameweek.",
        priority: 8,
      });
    } else if (next7 <= 1) {
      out.push({
        key: "light",
        label: "LIGHT",
        tone: "slate",
        icon: CalendarClock,
        tooltip: `Light schedule: ${next7} game(s) in next 7d.`,
        priority: 8,
      });
    }
  }

  // 9. Role boost
  if (mpg5 > 0 && mpg > 0 && (mpg5 >= mpg + 4 || mpg5 >= mpg * 1.15)) {
    out.push({
      key: "roleplus",
      label: "ROLE+",
      tone: "lime",
      icon: TrendingUp,
      tooltip: `Role boost: ${mpg5.toFixed(1)} MPG (L5) vs ${mpg.toFixed(1)} season.`,
      priority: 9,
    });
  }

  // 10. Minutes risk
  if (mpg5 > 0 && mpg > 0 && mpg5 <= mpg - 4) {
    out.push({
      key: "minrisk",
      label: "MIN RISK",
      tone: "yellow",
      icon: TrendingDown,
      tooltip: `Minutes risk: ${mpg5.toFixed(1)} MPG (L5) vs ${mpg.toFixed(1)} season.`,
      priority: 10,
    });
  }

  // 11. Captain edge
  if (fp5 > 0 && ctx.pool.fp5P90 > 0 && fp5 >= ctx.pool.fp5P90) {
    out.push({
      key: "cap",
      label: "CAP",
      tone: "gold",
      icon: Crown,
      tooltip: `Captain edge: FP5 ${fp5.toFixed(1)} (pool top 10% ≥ ${ctx.pool.fp5P90.toFixed(1)}).`,
      priority: 11,
    });
  }

  // 12. Roster fit
  if ((ctx.rosterNeedsFc && p.fc_bc === "FC") || (ctx.rosterNeedsBc && p.fc_bc === "BC")) {
    out.push({
      key: "fit",
      label: "FIT",
      tone: "indigo",
      icon: Puzzle,
      tooltip: `Roster fit: helps ${p.fc_bc} balance.`,
      priority: 12,
    });
  }

  // 13. Owned
  if (ctx.isOwned) {
    out.push({
      key: "owned",
      label: "OWNED",
      tone: "sky",
      icon: BadgeCheck,
      tooltip: "Already on your roster.",
      priority: 13,
    });
  }

  // 14. Watchlist
  if (ctx.isInWishlist) {
    out.push({
      key: "watch",
      label: "WATCH",
      tone: "violet",
      icon: Star,
      tooltip: "Player is on your watchlist.",
      priority: 14,
    });
  }

  return out.sort((a, b) => a.priority - b.priority);
}

/**
 * Premium per-tone styling. Each badge is a small circular "gem":
 * gradient background, tinted ring, glowing shadow, crisp icon.
 * Static class strings so Tailwind's JIT keeps them.
 */
const TONE_CLS: Record<BadgeTone, string> = {
  red:    "ring-red-500/40 bg-gradient-to-br from-red-500/25 to-red-600/10 text-red-300 shadow-[0_0_8px_-2px_rgba(239,68,68,0.6)]",
  rose:   "ring-rose-500/40 bg-gradient-to-br from-rose-500/25 to-rose-600/10 text-rose-300 shadow-[0_0_8px_-2px_rgba(244,63,94,0.55)]",
  orange: "ring-orange-500/45 bg-gradient-to-br from-orange-500/30 to-amber-600/10 text-orange-300 shadow-[0_0_10px_-2px_rgba(249,115,22,0.65)]",
  amber:  "ring-amber-500/40 bg-gradient-to-br from-amber-500/25 to-amber-600/10 text-amber-300 shadow-[0_0_8px_-2px_rgba(245,158,11,0.55)]",
  yellow: "ring-yellow-500/40 bg-gradient-to-br from-yellow-500/25 to-yellow-600/10 text-yellow-300 shadow-[0_0_8px_-2px_rgba(234,179,8,0.5)]",
  lime:   "ring-lime-500/40 bg-gradient-to-br from-lime-500/25 to-lime-600/10 text-lime-300 shadow-[0_0_8px_-2px_rgba(132,204,22,0.5)]",
  green:  "ring-emerald-500/45 bg-gradient-to-br from-emerald-500/25 to-emerald-600/10 text-emerald-300 shadow-[0_0_10px_-2px_rgba(16,185,129,0.6)]",
  teal:   "ring-teal-500/40 bg-gradient-to-br from-teal-500/25 to-teal-600/10 text-teal-300 shadow-[0_0_8px_-2px_rgba(20,184,166,0.55)]",
  cyan:   "ring-cyan-500/40 bg-gradient-to-br from-cyan-500/25 to-cyan-600/10 text-cyan-300 shadow-[0_0_8px_-2px_rgba(6,182,212,0.55)]",
  sky:    "ring-sky-500/40 bg-gradient-to-br from-sky-500/25 to-sky-600/10 text-sky-300 shadow-[0_0_8px_-2px_rgba(14,165,233,0.55)]",
  indigo: "ring-indigo-500/40 bg-gradient-to-br from-indigo-500/25 to-indigo-600/10 text-indigo-300 shadow-[0_0_8px_-2px_rgba(99,102,241,0.55)]",
  gold:   "ring-yellow-400/60 bg-gradient-to-br from-yellow-400/30 via-amber-400/20 to-yellow-600/10 text-yellow-200 shadow-[0_0_12px_-2px_rgba(250,204,21,0.7)]",
  violet: "ring-violet-500/40 bg-gradient-to-br from-violet-500/25 to-fuchsia-600/10 text-violet-300 shadow-[0_0_8px_-2px_rgba(139,92,246,0.55)]",
  slate:  "ring-slate-500/40 bg-gradient-to-br from-slate-500/20 to-slate-700/10 text-slate-300 shadow-[0_0_6px_-2px_rgba(100,116,139,0.45)]",
};

export default function PlayerContextBadges({
  badges,
  max = 3,
  iconOnly = true,
  className,
}: {
  badges: PlayerBadge[];
  max?: number;
  iconOnly?: boolean;
  className?: string;
}) {
  if (!badges || badges.length === 0) return null;
  const visible = badges.slice(0, max);
  const hidden = badges.slice(max);
  return (
    <span className={cn("inline-flex items-center gap-1 shrink-0", className)}>
      {visible.map((b) => {
        const Icon = b.icon;
        return (
          <Tooltip key={b.key}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex items-center justify-center h-[18px] w-[18px] rounded-full ring-1 backdrop-blur-sm transition-transform hover:scale-110",
                  TONE_CLS[b.tone],
                )}
                aria-label={b.label}
              >
                <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                {!iconOnly && (
                  <span className="ml-0.5 font-heading font-bold uppercase tracking-wider text-[7.5px]">
                    {b.label}
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] max-w-[220px]">
              <div className="font-heading font-bold uppercase tracking-wider text-[10px] mb-0.5">{b.label}</div>
              <div>{b.tooltip}</div>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {hidden.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center justify-center h-[18px] min-w-[22px] px-1 rounded-full ring-1 ring-border bg-muted/60 text-[9px] font-mono font-bold text-muted-foreground">
              +{hidden.length}
            </span>
          </TooltipTrigger>
          <TooltipContent className="text-[10px] max-w-[240px]">
            <div className="space-y-0.5">
              {hidden.map((h) => (
                <div key={h.key}>
                  <b>{h.label}</b> — {h.tooltip}
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}