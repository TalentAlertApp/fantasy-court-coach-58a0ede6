import { cn } from "@/lib/utils";
import BallersIQBrand from "./BallersIQBrand";
import type { BallersIQInsight } from "@/lib/ballers-iq";

const ACTION_STYLES: Record<string, string> = {
  START: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  BENCH: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  CAPTAIN: "bg-amber-400/15 text-amber-300 border-amber-400/40",
  ADD: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  DROP: "bg-red-500/15 text-red-300 border-red-500/30",
  WATCH: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  HOLD: "bg-foreground/10 text-foreground/80 border-border",
};

const RISK_STYLES: Record<string, string> = {
  LOW: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  MEDIUM: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  HIGH: "bg-red-500/10 text-red-400 border-red-500/30",
};

interface Props {
  insight: BallersIQInsight;
  className?: string;
  compact?: boolean;
  onClick?: () => void;
}

export default function BallersIQCard({ insight, className, compact, onClick }: Props) {
  const Component: any = onClick ? "button" : "div";
  return (
    <Component
      onClick={onClick}
      className={cn(
        "group relative w-full text-left rounded-xl border border-border bg-card/70 backdrop-blur-sm",
        "p-3 shadow-[0_2px_10px_-6px_hsl(var(--primary)/0.25)]",
        "hover:border-amber-400/50 hover:shadow-[0_4px_20px_-8px_hsl(45_90%_55%/0.3)] transition-all",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <BallersIQBrand variant="emblem" size={compact ? "sm" : "md"} className="shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-heading font-bold uppercase tracking-[0.14em] text-amber-400/90">
              {insight.title}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {insight.action && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md border text-[9px] font-heading font-bold uppercase tracking-wider",
                  ACTION_STYLES[insight.action] ?? "border-border",
                )}>{insight.action}</span>
              )}
              {insight.riskLevel && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-md border text-[9px] font-heading font-bold uppercase tracking-wider",
                  RISK_STYLES[insight.riskLevel],
                )}>{insight.riskLevel}</span>
              )}
            </div>
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground leading-snug">{insight.headline}</p>
          {insight.bullets.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {insight.bullets.map((b, i) => (
                <li key={i} className="text-[11px] text-muted-foreground leading-snug pl-2 relative before:content-['·'] before:absolute before:left-0 before:text-amber-400/70">
                  {b}
                </li>
              ))}
            </ul>
          )}
          {typeof insight.confidence === "number" && (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="h-1 flex-1 max-w-[80px] rounded-full bg-foreground/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500"
                  style={{ width: `${Math.round(insight.confidence * 100)}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-muted-foreground">
                {Math.round(insight.confidence * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </Component>
  );
}