import { cn } from "@/lib/utils";
import BallersIQBrand from "./BallersIQBrand";

interface Item {
  label: string; // short tag e.g. "Captain Edge"
  text: string;
}

interface Props {
  items: Item[];
  className?: string;
}

/** Ballers.IQ — short horizontal ticker of one-liners. CSS marquee, pauses on hover. */
export default function BallersIQTicker({ items, className }: Props) {
  if (!items.length) return null;
  // Duplicate for seamless loop
  const loop = [...items, ...items];
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border border-border bg-card/70 backdrop-blur-sm overflow-hidden",
      "px-3 py-2 shadow-[0_2px_10px_-6px_hsl(var(--primary)/0.25)]",
      className,
    )}>
      <div className="flex items-center gap-2 shrink-0 pr-3 border-r border-border">
        <BallersIQBrand variant="emblem" size="sm" />
        <span className="text-[9px] font-heading font-bold uppercase tracking-[0.18em] text-amber-400/90">
          Ballers.IQ
        </span>
      </div>
      <div className="relative flex-1 overflow-hidden group">
        <div className="flex gap-8 whitespace-nowrap animate-[biq-marquee_28s_linear_infinite] group-hover:[animation-play-state:paused]">
          {loop.map((it, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-[11px]">
              <span className="font-heading font-bold uppercase tracking-wider text-amber-400/90">
                {it.label}
              </span>
              <span className="text-foreground/85">{it.text}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}