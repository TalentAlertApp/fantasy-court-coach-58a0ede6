import * as React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { PlayerHealth } from "@/lib/health";
import { getHealthLabel } from "@/lib/health";

export interface HealthTooltipProps {
  health: PlayerHealth | null | undefined;
  children: React.ReactNode;
  /** If true, render the tooltip even for null/clear health (with "No active issue"). */
  alwaysShow?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

function fmtDate(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Wrap a trigger element to show the player's health detail on hover.
 * Degrades gracefully when fields are missing.
 */
export default function HealthTooltip({
  health,
  children,
  alwaysShow = false,
  side = "top",
  className,
}: HealthTooltipProps) {
  const hasIssue = !!health?.status;
  if (!hasIssue && !alwaysShow) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {!hasIssue ? (
          <div className="text-[10.5px] leading-tight text-muted-foreground">
            No active health issue.
          </div>
        ) : (
          <div className="text-[10.5px] leading-tight space-y-0.5 max-w-[220px]">
            <div className="font-heading font-bold uppercase tracking-wider text-[9.5px]">
              {getHealthLabel(health!)}
            </div>
            {health!.injury_type && <div>{health!.injury_type}</div>}
            {health!.reason && !health!.injury_type && (
              <div className="capitalize">Reason: {health!.reason}</div>
            )}
            {health!.estimated_return && (
              <div className="text-muted-foreground">Est. return: {health!.estimated_return}</div>
            )}
            {health!.notes && (
              <div className="text-muted-foreground italic line-clamp-3">{health!.notes}</div>
            )}
            {(health!.updated_at || health!.source) && (
              <div className="text-muted-foreground/80 text-[9.5px] pt-0.5">
                {fmtDate(health!.updated_at) ?? ""}
                {health!.updated_at && health!.source ? " · " : ""}
                {health!.source ?? ""}
              </div>
            )}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}