import * as React from "react";
import { cn } from "@/lib/utils";
import type { PlayerHealth } from "@/lib/health";
import { getHealthTone } from "@/lib/health";

export interface HealthStatusBadgeProps {
  health: PlayerHealth | null | undefined;
  /** Smaller pill (h-3.5, tighter padding). */
  compact?: boolean;
  /** PROB is hidden by default; set true to surface it. */
  showProbable?: boolean;
  className?: string;
}

/**
 * Tiny status pill: OUT / Q / DTD / GTD / PROB.
 * Renders nothing for null/clear health.
 * No heavy container — just a colored chip with the bucket code.
 */
export default function HealthStatusBadge({
  health,
  compact = false,
  showProbable = false,
  className,
}: HealthStatusBadgeProps) {
  if (!health || !health.status) return null;
  if (health.status === "PROB" && !showProbable) return null;

  const tone = getHealthTone(health.status);

  const toneCls =
    tone === "danger"
      ? "bg-red-500/15 text-red-400 border-red-500/40"
      : tone === "warning"
      ? "bg-amber-400/15 text-amber-400 border-amber-400/40"
      : "bg-muted/40 text-muted-foreground border-border/60";

  const sizeCls = compact
    ? "h-3.5 px-1 text-[8.5px]"
    : "h-4 px-1.5 text-[9px]";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-sm border font-heading font-bold uppercase tracking-wider leading-none",
        sizeCls,
        toneCls,
        className,
      )}
      aria-label={`Health: ${health.status}`}
    >
      {health.status}
    </span>
  );
}