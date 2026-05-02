import { cn } from "@/lib/utils";
import BallersIQBrand from "./BallersIQBrand";
import type { BallersIQInsight } from "@/lib/ballers-iq";

const ACTION_STYLES: Record<string, string> = {
  START: "bg-emerald-500 text-emerald-50",
  BENCH: "bg-zinc-500 text-zinc-50",
  CAPTAIN: "bg-amber-400 text-amber-950",
  ADD: "bg-sky-500 text-sky-50",
  DROP: "bg-red-500 text-red-50",
  WATCH: "bg-violet-500 text-violet-50",
  HOLD: "bg-foreground/15 text-foreground",
};

const RISK_STYLES: Record<string, string> = {
  LOW: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  MEDIUM: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  HIGH: "bg-red-500/10 text-red-400 border-red-500/30",
};

interface Props {
  insight: BallersIQInsight;
  className?: string;
}

export default function BallersIQPlayerVerdict({ insight, className }: Props) {
  const action = insight.action ?? "HOLD";
  return (
    <div className={cn(
      "relative rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-card to-card p-2",
      "shadow-[0_4px_20px_-10px_hsl(45_90%_55%/0.5)]",
      className,
    )}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
      <div className="flex items-center gap-2 mb-1.5">
        <BallersIQBrand variant="emblem" size="sm" />
        <span className="text-[9px] font-heading font-bold uppercase tracking-[0.18em] text-amber-400/90">
          Ballers.IQ Verdict
        </span>
        {typeof insight.confidence === "number" && (
          <span className="text-[9px] font-mono text-muted-foreground">
            {Math.round(insight.confidence * 100)}%
          </span>
        )}
        {insight.riskLevel && (
          <span className={cn(
            "ml-auto px-1.5 py-0.5 rounded-md border text-[9px] font-heading font-bold uppercase tracking-wider",
            RISK_STYLES[insight.riskLevel],
          )}>
            {insight.riskLevel}
          </span>
        )}
      </div>
      <div className="flex items-start gap-2.5">
        <div className={cn(
          "shrink-0 px-2.5 py-1.5 rounded-lg font-heading font-black uppercase tracking-wider text-xs leading-none",
          ACTION_STYLES[action],
        )}>
          {action}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-snug">{insight.headline}</p>
          {insight.bullets.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {insight.bullets.slice(0, 2).map((b, i) => (
                <li key={i} className="text-[10.5px] text-muted-foreground leading-snug pl-2 relative before:content-['·'] before:absolute before:left-0 before:text-amber-400/70">
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}