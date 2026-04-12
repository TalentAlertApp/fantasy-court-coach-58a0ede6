import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import { ArrowLeftRight, GripVertical } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import type { UpcomingGame } from "@/hooks/useUpcomingByTeam";
import React from "react";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface PlayerCardProps {
  player: PlayerListItem;
  isCaptain?: boolean;
  onClick?: () => void;
  onSwap?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  variant?: "court" | "bench";
  compact?: boolean;
  upcoming?: (UpcomingGame | null)[];
}

function formatShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].toUpperCase();
  const firstInitial = parts[0][0];
  const lastName = parts[parts.length - 1];
  return `${firstInitial}.${lastName}`.toUpperCase();
}

function OpponentBadge({ tricode, size = "sm" }: { tricode: string; size?: "sm" | "md" }) {
  const logo = getTeamLogo(tricode);
  const cls = size === "md" ? "w-7 h-7" : "w-4 h-4";
  return logo ? (
    <img src={logo} alt={tricode} className={`${cls} object-contain transition-transform hover:scale-110`} title={tricode} />
  ) : (
    <span className="text-[6px] font-bold text-muted-foreground">{tricode}</span>
  );
}

export default function PlayerCard({
  player, isCaptain, onClick, onSwap, draggable,
  onDragStart, onDragOver, onDrop, onDragEnd, variant, compact, upcoming,
}: PlayerCardProps) {
  const { core } = player;
  const isFc = core.fc_bc === "FC";
  const accentColor = isFc ? "border-destructive" : "border-primary";
  const teamLogo = getTeamLogo(core.team);
  const v5 = (player.computed as any)?.value5;

  // Max 6 slots, left-to-right chronological
  const allUpcoming = upcoming ?? [];
  const nextGame = allUpcoming[0] ?? null;
  const upcomingDays = allUpcoming.slice(0, 6);

  const resolvedVariant = variant ?? "court";

  // ─── BENCH VARIANT ───
  if (resolvedVariant === "bench") {
    return (
      <div
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onClick={onClick}
        className={`bg-card/95 backdrop-blur-sm border-l-2 ${accentColor} rounded-xl cursor-pointer hover:ring-1 hover:ring-accent/50 hover:shadow-lg transition-all duration-200 relative group overflow-hidden`}
      >
        {isCaptain && <span className="absolute top-0 right-1 text-xs z-10" title="Captain">⭐</span>}

        {draggable && (
          <div className="absolute top-1 left-0.5 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing z-10">
            <GripVertical className="h-3 w-3 text-muted-foreground" />
          </div>
        )}

        {onSwap && (
          <button
            onClick={(e) => { e.stopPropagation(); onSwap(); }}
            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-accent text-accent-foreground rounded-lg p-0.5 hover:bg-accent/80 z-10"
            title="Swap player"
          >
            <ArrowLeftRight className="h-2.5 w-2.5" />
          </button>
        )}

        <div className="flex items-stretch">
          {teamLogo && (
            <div className="w-12 shrink-0 flex items-center justify-center bg-muted/30 rounded-l-xl">
              <img src={teamLogo} alt={core.team} className="w-9 h-9 transition-transform group-hover:scale-110" />
            </div>
          )}
          <div className="flex-1 px-2 py-1.5 min-w-0">
            <p className="text-sm font-heading font-bold leading-tight truncate">
              {formatShortName(core.name)}
            </p>

            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={isFc ? "destructive" : "default"} className="text-[7px] px-1 py-0 rounded-lg h-3.5 shrink-0">
                {core.fc_bc}
              </Badge>
              <span className="text-[9px] text-muted-foreground font-mono shrink-0">${core.salary}</span>
              {v5 != null && (
                <>
                  <span className="text-muted-foreground/40 text-[8px]">|</span>
                  <span className="text-[9px] text-muted-foreground font-mono shrink-0">{Number(v5).toFixed(1)}</span>
                </>
              )}

              {upcoming && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[6px] font-heading font-bold text-muted-foreground uppercase">Next</span>
                  {nextGame ? <OpponentBadge tricode={nextGame.opponent} size="md" /> : <span className="text-[7px] text-muted-foreground">—</span>}
                </div>
              )}

              {upcoming && upcomingDays.length > 0 && (
                <div className="flex items-center gap-0.5 shrink-0">
                  {upcomingDays.map((day, i) => (
                    <div key={i} className="flex items-center justify-center w-5 h-5">
                      {day ? <OpponentBadge tricode={day.opponent} size="md" /> : <span className="text-[5px] text-muted-foreground/40">—</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── COURT VARIANT (default) ───
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-card/95 backdrop-blur-sm border-t-2 ${accentColor} rounded-xl cursor-pointer hover:ring-1 hover:ring-accent/50 hover:shadow-lg transition-all duration-200 relative group overflow-hidden`}
      style={{ minWidth: 0 }}
    >
      {isCaptain && <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs z-10" title="Captain">⭐</span>}

      {draggable && (
        <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing z-10">
          <GripVertical className="h-2.5 w-2.5 text-muted-foreground" />
        </div>
      )}

      {onSwap && (
        <button
          onClick={(e) => { e.stopPropagation(); onSwap(); }}
          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-accent text-accent-foreground rounded-lg p-0.5 hover:bg-accent/80 z-10"
          title="Swap player"
        >
          <ArrowLeftRight className="h-2.5 w-2.5" />
        </button>
      )}

      {/* Header: team logo */}
      <div className="flex items-center justify-between px-1.5 pt-1">
        <div className="flex items-center gap-0.5">
          {teamLogo && <img src={teamLogo} alt={core.team} className="w-7 h-7 transition-transform group-hover:scale-110" />}
        </div>
        <span className="text-[8px] font-heading font-bold text-muted-foreground">{core.team}</span>
      </div>

      {/* Photo */}
      <div className="flex justify-center py-0.5">
        {core.photo ? (
          <img src={core.photo} alt={core.name} className="w-16 h-16 rounded-full object-cover bg-muted transition-transform group-hover:scale-110" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xs font-heading font-bold text-muted-foreground">
            {core.name.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Name */}
      <p className="text-sm font-heading font-bold text-center truncate px-0.5 leading-tight">
        {formatShortName(core.name)}
      </p>

      {/* FC/BC badge + salary + V5 */}
      <div className="flex items-center justify-center gap-1 py-0.5">
        <Badge variant={isFc ? "destructive" : "default"} className="text-[8px] px-1 py-0 rounded-lg h-4">
          {core.fc_bc}
        </Badge>
        <span className="text-[9px] text-muted-foreground font-mono">${core.salary}</span>
        {v5 != null && (
          <>
            <span className="text-muted-foreground/40 text-[8px]">|</span>
            <span className="text-[9px] text-muted-foreground font-mono">{Number(v5).toFixed(1)}</span>
          </>
        )}
      </div>

      {/* Upcoming games — 6 slots */}
      {upcoming && upcomingDays.length > 0 && (
        <div className="border-t border-border/50 px-0.5 py-0.5">
          <div className="grid grid-cols-6 gap-0">
            {Array.from({ length: 6 }, (_, i) => upcomingDays[i] ?? null).map((day, i) => (
              <div key={i} className="flex items-center justify-center h-6">
                {day ? <OpponentBadge tricode={day.opponent} size="md" /> : <span className="text-[5px] text-muted-foreground/40">—</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
