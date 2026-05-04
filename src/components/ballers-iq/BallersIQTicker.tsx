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
      "relative flex items-center rounded-xl border border-border bg-card/70 backdrop-blur-sm overflow-hidden",
      "pl-2 pr-2 py-2 shadow-[0_2px_10px_-6px_hsl(var(--primary)/0.25)]",
      className,
    )}>
      {/* Emblem icon — transparent, no container */}
      <BallersIQBrand
        variant="emblem"
        size="sm"
        forceTheme="light"
        transparent
        className="shrink-0 !h-6 !w-6 mr-2"
      />
      <div className="relative flex-1 min-w-0 overflow-hidden group">
        <div className="flex gap-10 whitespace-nowrap animate-[biq-marquee_32s_linear_infinite] group-hover:[animation-play-state:paused] w-max">
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