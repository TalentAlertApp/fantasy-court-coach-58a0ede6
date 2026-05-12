import * as React from "react";
import { ShieldAlert, CircleAlert, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlayerHealth } from "@/lib/health";
import { getHealthTone, getHealthLabel } from "@/lib/health";

export interface HealthStatusIconProps {
  health: PlayerHealth | null | undefined;
  size?: "xs" | "sm" | "md";
  interactive?: boolean;
  className?: string;
  title?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement | HTMLSpanElement>) => void;
}

const SIZE_MAP: Record<NonNullable<HealthStatusIconProps["size"]>, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
};

/**
 * Compact premium status indicator. Renders nothing for null/clear health.
 * - OUT  → red ShieldAlert with subtle glow
 * - Q/GTD → amber CircleAlert
 * - DTD  → muted-amber CircleAlert
 * - PROB → muted Activity
 */
export default function HealthStatusIcon({
  health,
  size = "sm",
  interactive = false,
  className,
  title,
  onClick,
}: HealthStatusIconProps) {
  if (!health || !health.status) return null;

  const tone = getHealthTone(health.status);
  const Icon =
    health.status === "OUT" ? ShieldAlert :
    health.status === "PROB" ? Activity :
    CircleAlert;

  const toneCls =
    tone === "danger"
      ? "text-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.45)]"
      : tone === "warning"
      ? "text-amber-400"
      : tone === "muted"
      ? "text-muted-foreground/80"
      : "text-muted-foreground";

  const aria = title ?? `${getHealthLabel(health)} — health status`;

  if (interactive || onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={aria}
        title={aria}
        className={cn(
          "inline-flex items-center justify-center rounded-md p-0.5 transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <Icon className={cn(SIZE_MAP[size], toneCls)} aria-hidden="true" />
      </button>
    );
  }

  return (
    <span
      role="img"
      aria-label={aria}
      title={aria}
      className={cn("inline-flex items-center", className)}
    >
      <Icon className={cn(SIZE_MAP[size], toneCls)} aria-hidden="true" />
    </span>
  );
}