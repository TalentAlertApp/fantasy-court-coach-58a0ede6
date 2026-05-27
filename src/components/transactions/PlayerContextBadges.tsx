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
      icon: Activity,
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
      tone: "red",
      icon: AlertTriangle,
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
      icon: DollarSign,
      tooltip: `Value add: V5 ${v5.toFixed(1)} (pool top quartile ≥ ${ctx.pool.value5Q75.toFixed(1)}).`,
      priority: 4,
    });
  }

  // 5. Hot Form
  if (fp5 > 0 && fp > 0 && (fp5 >= fp + 5 || fp5 >= fp * 1.15)) {
    out.push({
      key: "hot",
      label: "HOT",
      tone: "green",
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
      tone: "blue",
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
        tone: "green",
        icon: CalendarPlus,
        tooltip: `Strong schedule: ${thisGw} this GW · ${next7} in next 7d.`,
        priority: 7,
      });
    } else if (thisGw === 0) {
      out.push({
        key: "nogame",
        label: "NO GAME",
        tone: "amber",
        icon: CalendarOff,
        tooltip: "No games scheduled in the current gameweek.",
        priority: 8,
      });
    } else if (next7 <= 1) {
      out.push({
        key: "light",
        label: "LIGHT",
        tone: "neutral",
        icon: CalendarOff,
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
      tone: "green",
      icon: Clock,
      tooltip: `Role boost: ${mpg5.toFixed(1)} MPG (L5) vs ${mpg.toFixed(1)} season.`,
      priority: 9,
    });
  }

  // 10. Minutes risk
  if (mpg5 > 0 && mpg > 0 && mpg5 <= mpg - 4) {
    out.push({
      key: "minrisk",
      label: "MIN RISK",
      tone: "amber",
      icon: Clock,
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
      tone: "blue",
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
      tone: "blue",
      icon: Check,
      tooltip: "Already on your roster.",
      priority: 13,
    });
  }

  // 14. Watchlist
  if (ctx.isInWishlist) {
    out.push({
      key: "watch",
      label: "WATCH",
      tone: "purple",
      icon: Star,
      tooltip: "Player is on your watchlist.",
      priority: 14,
    });
  }

  return out.sort((a, b) => a.priority - b.priority);
}

const TONE_CLS: Record<BadgeTone, string> = {
  red: "border-red-500/40 text-red-400 bg-red-500/10",
  amber: "border-amber-500/40 text-amber-400 bg-amber-500/10",
  green: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
  blue: "border-sky-500/40 text-sky-400 bg-sky-500/10",
  gold: "border-yellow-500/50 text-yellow-400 bg-yellow-500/10",
  purple: "border-violet-500/40 text-violet-400 bg-violet-500/10",
  neutral: "border-border text-muted-foreground bg-muted/40",
};

export default function PlayerContextBadges({
  badges,
  max = 3,
  iconOnly = false,
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
    <span className={cn("inline-flex items-center gap-0.5 shrink-0", className)}>
      {visible.map((b) => {
        const Icon = b.icon;
        return (
          <Tooltip key={b.key}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 h-3.5 rounded-sm border px-1 font-heading font-bold uppercase tracking-wider text-[7.5px]",
                  TONE_CLS[b.tone],
                )}
              >
                <Icon className="h-2.5 w-2.5" aria-hidden />
                {!iconOnly && <span>{b.label}</span>}
              </span>
            </TooltipTrigger>
            <TooltipContent className="text-[10px] max-w-[220px]">{b.tooltip}</TooltipContent>
          </Tooltip>
        );
      })}
      {hidden.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center h-3.5 rounded-sm border px-1 text-[7.5px] font-heading font-bold uppercase tracking-wider border-border text-muted-foreground bg-muted/40">
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