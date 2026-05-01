import { cn } from "@/lib/utils";
import BallersIQBrand from "./BallersIQBrand";
import BallersIQCard from "./BallersIQCard";
import type { BallersIQResponse } from "@/lib/ballers-iq";

interface Props {
  data: BallersIQResponse;
  className?: string;
}

export default function BallersIQRecapBlock({ data, className }: Props) {
  if (!data || (!data.summary && !data.insights.length)) return null;
  return (
    <section className={cn(
      "relative rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/[0.06] via-card to-card",
      "p-4 shadow-[0_4px_24px_-12px_hsl(45_90%_55%/0.35)] overflow-hidden",
      className,
    )}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
      <header className="flex items-center gap-3 mb-3">
        <BallersIQBrand variant="wordmark" size="md" />
        <span className="text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-muted-foreground border-l border-border pl-3">
          Recap Story
        </span>
      </header>
      {data.summary && (
        <p className="text-sm text-foreground/90 leading-snug mb-3">{data.summary}</p>
      )}
      {data.insights.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-2">
          {data.insights.map((ins, i) => (
            <BallersIQCard key={i} insight={ins} compact />
          ))}
        </div>
      )}
    </section>
  );
}