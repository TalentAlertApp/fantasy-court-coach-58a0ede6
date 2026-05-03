import { cn } from "@/lib/utils";
import BallersIQBrand from "./BallersIQBrand";
import BallersIQCard from "./BallersIQCard";
import type { BallersIQResponse } from "@/lib/ballers-iq";

interface Props {
  data: BallersIQResponse | null;
  className?: string;
  /** Show the X close button at top-right (used in overlay mode). */
  onClose?: () => void;
}

/** Premium Ballers.IQ Lineup Advisor card.
 * - Wordmark "logo" sits to the far left, blends into card background.
 * - Emblem watermark at top-right, oversized + rotated like the player modal team-badge watermark.
 */
export default function LineupAdvisorPanel({ data, className, onClose }: Props) {
  if (!data || !data.insights.length) return null;
  return (
    <section
      className={cn(
        "relative rounded-2xl border border-amber-400/30 bg-card overflow-hidden",
        "shadow-[0_8px_32px_-12px_hsl(45_90%_55%/0.45)]",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
      {/* Emblem watermark — top right, oversized, rotated, subtle (matches PlayerModal team badge style) */}
      <BallersIQBrand
        variant="emblem"
        forceTheme="light"
        transparent
        className="pointer-events-none absolute -top-8 -right-8 !h-44 !w-44 object-contain opacity-[0.18] rotate-12 select-none"
      />
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 z-10 h-7 w-7 inline-flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          ×
        </button>
      )}

      <div className="relative z-[1] flex items-stretch gap-3 p-3">
        {/* Left: wordmark "logo" — fully transparent, blends with card bg */}
        <div className="shrink-0 flex flex-col items-center justify-center px-2 border-r border-border/40">
          <BallersIQBrand
            variant="wordmark"
            forceTheme="light"
            transparent
            className="!h-7 w-auto"
          />
          <span className="mt-1 text-[9px] font-heading font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Lineup Advisor
          </span>
        </div>
        <div className="flex-1 min-w-0">
          {data.summary && (
            <p className="text-[12px] text-muted-foreground leading-snug mb-2">{data.summary}</p>
          )}
          <div className="grid sm:grid-cols-2 gap-2">
            {data.insights.map((ins, i) => (
              <BallersIQCard key={i} insight={ins} compact />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}