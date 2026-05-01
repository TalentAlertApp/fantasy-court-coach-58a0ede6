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
      "relative rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-card to-card p-3",
      "shadow-[0_4px_20px_-10px_hsl(45_90%_55%/0.5)]",
      className,
    )}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
      <div className="flex items-center gap-2 mb-2">
        <BallersIQBrand variant="emblem" size="sm" />
        <span className="text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-amber-400/90">
          Ballers.IQ Verdict
        </span>
        {insight.riskLevel && (
          <span className={cn(
            "ml-auto px-1.5 py-0.5 rounded-md border text-[9px] font-heading font-bold uppercase tracking-wider",
            RISK_STYLES[insight.riskLevel],
          )}>
            {insight.riskLevel} RISK
          </span>
        )}
      </div>
      <div className="flex items-start gap-3">
        <div className={cn(
          "shrink-0 px-3 py-2 rounded-lg font-heading font-black uppercase tracking-wider text-sm leading-none",
          ACTION_STYLES[action],
        )}>
          {action}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-snug">{insight.headline}</p>
          {insight.bullets.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {insight.bullets.slice(0, 3).map((b, i) => (
                <li key={i} className="text-[11px] text-muted-foreground leading-snug pl-2 relative before:content-['·'] before:absolute before:left-0 before:text-amber-400/70">
                  {b}
                </li>
              ))}
            </ul>
          )}
          {typeof insight.confidence === "number" && (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="h-1 flex-1 max-w-[100px] rounded-full bg-foreground/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500"
                  style={{ width: `${Math.round(insight.confidence * 100)}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-muted-foreground">
                Confidence {Math.round(insight.confidence * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}