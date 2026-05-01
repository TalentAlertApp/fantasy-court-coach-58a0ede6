import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import BallersIQBrand from "./BallersIQBrand";

interface Props {
  title?: string;
  summary?: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}

export default function BallersIQPanel({ title, summary, children, className, compact }: Props) {
  return (
    <section
      className={cn(
        "relative rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden",
        "shadow-[0_4px_24px_-12px_hsl(45_90%_55%/0.25)]",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
      <header className={cn("flex items-center gap-2.5", compact ? "px-3 py-2" : "px-4 py-3")}>
        <BallersIQBrand variant="wordmark" size={compact ? "sm" : "md"} />
        {title && (
          <span className="text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-muted-foreground border-l border-border pl-2.5">
            {title}
          </span>
        )}
      </header>
      {summary && (
        <p className={cn("text-[11px] text-muted-foreground", compact ? "px-3 -mt-1 pb-2" : "px-4 -mt-1 pb-2")}>
          {summary}
        </p>
      )}
      <div className={cn("space-y-2", compact ? "px-3 pb-3" : "px-4 pb-4")}>{children}</div>
    </section>
  );
}