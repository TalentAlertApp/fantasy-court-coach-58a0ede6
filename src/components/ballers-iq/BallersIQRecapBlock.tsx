import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import BallersIQBrand from "./BallersIQBrand";
import BallersIQCard from "./BallersIQCard";
import type { BallersIQResponse } from "@/lib/ballers-iq";

interface Props {
  data: BallersIQResponse;
  className?: string;
  /** When set, render at most this many insight cards per page with </> nav. */
  pageSize?: number;
}

export default function BallersIQRecapBlock({ data, className, pageSize }: Props) {
  const [page, setPage] = useState(0);
  if (!data || (!data.summary && !data.insights.length)) return null;
  const insights = data.insights;
  const total = insights.length;
  const size = pageSize ?? total;
  const pages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(page, pages - 1);
  const slice = insights.slice(safePage * size, safePage * size + size);
  return (
    <section className={cn(
      "relative rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/[0.06] via-card to-card",
      "p-4 shadow-[0_4px_24px_-12px_hsl(45_90%_55%/0.35)] overflow-hidden",
      className,
    )}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
      {/* Emblem watermark — top right, oversized, rotated, transparent (matches Lineup Advisor) */}
      <BallersIQBrand
        variant="emblem"
        forceTheme="light"
        transparent
        className="pointer-events-none absolute -top-8 -right-8 !h-44 !w-44 object-contain opacity-[0.14] rotate-12 select-none"
      />
      <header className="flex items-center gap-3 mb-3">
        <BallersIQBrand variant="wordmark" size="md" forceTheme="light" transparent className="dark:hidden" />
        <BallersIQBrand variant="wordmark" size="md" forceTheme="dark" transparent className="hidden dark:block" />
        <span className="text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-muted-foreground border-l border-border pl-3">
          Recap Story
        </span>
      </header>
      {data.summary && (
        <p className="relative z-[1] text-sm text-foreground/90 leading-snug mb-3">{data.summary}</p>
      )}
      {total > 0 && (
        <div className="relative z-[1] flex items-stretch gap-2">
          {pages > 1 && (
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Previous"
              className="shrink-0 my-auto h-8 w-8 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div className={cn("flex-1 grid gap-2", pageSize ? "sm:grid-cols-3" : "sm:grid-cols-3")}>
            {slice.map((ins, i) => (
              <BallersIQCard key={`${safePage}-${i}`} insight={ins} compact watermark="none" />
            ))}
          </div>
          {pages > 1 && (
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={safePage >= pages - 1}
              aria-label="Next"
              className="shrink-0 my-auto h-8 w-8 inline-flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}