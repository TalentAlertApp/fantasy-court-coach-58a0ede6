import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import HealthStatusBadge from "./HealthStatusBadge";
import HealthStatusIcon from "./HealthStatusIcon";
import type { PlayerHealth } from "@/lib/health";
import { getHealthLabel } from "@/lib/health";

export interface HealthDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerName?: string;
  team?: string;
  playerPhoto?: string | null;
  health: PlayerHealth | null | undefined;
}

function fantasyImpact(status: PlayerHealth["status"]): string {
  switch (status) {
    case "OUT":
      return "Unavailable — remove from Starting 5 and avoid captain.";
    case "Q":
    case "DTD":
    case "GTD":
      return "Availability risk — monitor before lock and avoid captain unless cleared.";
    case "PROB":
      return "Minor flag — usually playable, monitor updates.";
    default:
      return "No active health restriction detected.";
  }
}

function fmtDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/50 last:border-b-0">
      <span className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground shrink-0">
        {label}
      </span>
      <span className="text-xs text-right break-words">{value}</span>
    </div>
  );
}

export default function HealthDetailsModal({
  open,
  onOpenChange,
  playerName,
  team,
  playerPhoto,
  health,
}: HealthDetailsModalProps) {
  const status = health?.status ?? null;
  const hasIssue = !!status;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 rounded-lg">
              {playerPhoto && <AvatarImage src={playerPhoto} alt={playerName ?? "Player"} />}
              <AvatarFallback className="text-xs">
                {(playerName ?? "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-heading uppercase tracking-tight truncate">
                {playerName ?? "Player"}
              </DialogTitle>
              <div className="text-[10.5px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                {team && <span>{team}</span>}
                {team && hasIssue && <span>·</span>}
                {hasIssue && (
                  <>
                    <HealthStatusIcon health={health!} size="xs" />
                    <span>{getHealthLabel(health!)}</span>
                  </>
                )}
              </div>
            </div>
            {hasIssue && <HealthStatusBadge health={health!} showProbable />}
          </div>
        </DialogHeader>

        <div className="px-5 py-3 space-y-2.5">
          {!hasIssue ? (
            <div className="text-xs text-muted-foreground italic">
              No current injury report found for this player.
            </div>
          ) : (
            <>
              {health!.injury_type && <Row label="Injury" value={health!.injury_type} />}
              {health!.reason && !health!.injury_type && (
                <Row label="Reason" value={<span className="capitalize">{health!.reason}</span>} />
              )}
              {health!.estimated_return && (
                <Row label="Est. return" value={health!.estimated_return} />
              )}
              {health!.notes && <Row label="Notes" value={health!.notes} />}
            </>
          )}
          {(health?.source || health?.updated_at) && (
            <Row
              label="Source"
              value={
                <span className="text-muted-foreground">
                  {health?.source ?? "—"}
                  {health?.updated_at ? ` · ${fmtDate(health.updated_at)}` : ""}
                </span>
              }
            />
          )}
        </div>

        <div className="px-5 pb-5">
          <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
            <div className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground mb-1">
              Fantasy impact
            </div>
            <div className="text-xs leading-snug">{fantasyImpact(status)}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}