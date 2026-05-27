import {
  HeartPulse,
  Activity,
  ShieldAlert,
  Gem,
  Flame,
  Snowflake,
  CalendarPlus,
  CalendarX,
  CalendarClock,
  TrendingUp,
  ClockAlert,
  Crown,
  Puzzle,
  BadgeAlert,
  CheckCircle2,
  Heart,
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
  | "amber"
  | "gold"
  | "green"
  | "blue"
  | "slate"
  | "violet"
  ;

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
      icon: ShieldAlert,
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
      tone: "amber",
      icon: BadgeAlert,
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
      icon: Gem,
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
        icon: CalendarX,
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
      tone: "green",
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
      tone: "amber",
      icon: ClockAlert,
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
      icon: CheckCircle2,
      tooltip: "Already on your roster.",
      priority: 13,
    });
  }

  // 14. Wishlist
  if (ctx.isInWishlist) {
    out.push({
      key: "watch",
      label: "WISH",
      tone: "violet",
      icon: Heart,
      tooltip: "Player is on your wishlist.",
      priority: 14,
    });
  }

  return out.sort((a, b) => a.priority - b.priority);
}

/**
 * Standalone icon tones — NO container, NO background, NO ring.
 * Just colored Lucide icons that "surge" on hover (scale, glow, lift, brighten).
 * Static class strings so Tailwind's JIT keeps them.
 */
const TONE_CLS: Record<BadgeTone, string> = {
  red:    "text-red-400 hover:text-red-300 hover:drop-shadow-[0_0_8px_rgba(248,113,113,0.65)]",
  amber:  "text-amber-300 hover:text-amber-200 hover:drop-shadow-[0_0_8px_rgba(252,211,77,0.65)]",
  gold:   "text-yellow-300 hover:text-yellow-200 hover:drop-shadow-[0_0_10px_rgba(250,204,21,0.75)]",
  green:  "text-emerald-300 hover:text-emerald-200 hover:drop-shadow-[0_0_8px_rgba(52,211,153,0.65)]",
  blue:   "text-sky-300 hover:text-sky-200 hover:drop-shadow-[0_0_8px_rgba(56,189,248,0.65)]",
  slate:  "text-slate-400 hover:text-slate-300 hover:drop-shadow-[0_0_7px_rgba(148,163,184,0.45)]",
  violet: "text-violet-300 hover:text-violet-200 hover:drop-shadow-[0_0_8px_rgba(167,139,250,0.65)]",
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
    <span className={cn("inline-flex items-center gap-1.5 shrink-0", className)}>
      {visible.map((b) => {
        const Icon = b.icon;
        return (
          <Tooltip key={b.key}>
            <TooltipTrigger asChild>
              <Icon
                aria-label={b.label}
                strokeWidth={2.25}
                className={cn(
                  "inline-block h-3.5 w-3.5 shrink-0 opacity-85 transition-all duration-200 ease-out",
                  "hover:opacity-100 hover:scale-125 hover:-translate-y-0.5 hover:brightness-125",
                  TONE_CLS[b.tone],
                )}
              />
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
            <span className="inline-block text-[9px] font-mono font-bold text-muted-foreground/80 hover:text-muted-foreground transition-colors">
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