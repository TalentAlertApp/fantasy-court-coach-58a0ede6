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

  // ─── COURT VARIANT — CINEMATIC ───
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="cursor-pointer group relative flex flex-col items-center"
      style={{ minWidth: 0 }}
    >
      {isCaptain && <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-sm z-20" title="Captain">⭐</span>}

      {draggable && (
        <div className="absolute top-0 left-0 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing z-20">
          <GripVertical className="h-3 w-3 text-white/70" />
        </div>
      )}

      {onSwap && (
        <button
          onClick={(e) => { e.stopPropagation(); onSwap(); }}
          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white rounded-full p-1 hover:bg-black/80 z-20"
          title="Swap player"
        >
          <ArrowLeftRight className="h-3 w-3" />
        </button>
      )}

      {/* Team logo watermark behind player */}
      {teamLogo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-15">
          <img src={teamLogo} alt="" className="w-20 h-20" />
        </div>
      )}

      {/* Photo — large, cinematic */}
      <div className="relative z-10">
        {core.photo ? (
          <img
            src={core.photo}
            alt={core.name}
            className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover bg-black/30 border-2 border-white/20 shadow-xl transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-black/40 border-2 border-white/20 flex items-center justify-center text-lg font-heading font-bold text-white/80">
            {core.name.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Name — bold, cinematic */}
      <p className="text-xs md:text-sm font-heading font-bold text-center text-white drop-shadow-lg leading-tight mt-1 truncate max-w-full z-10">
        {formatShortName(core.name)}
      </p>

      {/* FC/BC badge + salary + V5 */}
      <div className="flex items-center justify-center gap-1 mt-0.5 z-10">
        <Badge variant={isFc ? "destructive" : "default"} className="text-[7px] px-1 py-0 rounded h-3.5 shadow-md">
          {core.fc_bc}
        </Badge>
        <span className="text-[9px] text-white/80 font-mono drop-shadow">${core.salary}</span>
        {v5 != null && (
          <>
            <span className="text-white/40 text-[8px]">|</span>
            <span className="text-[9px] text-white/80 font-mono drop-shadow">{Number(v5).toFixed(1)}</span>
          </>
        )}
      </div>

      {/* Upcoming games — 6 slots */}
      {upcoming && upcomingDays.length > 0 && (
        <div className="flex items-center gap-0.5 mt-1 z-10">
          {Array.from({ length: 6 }, (_, i) => upcomingDays[i] ?? null).map((day, i) => (
            <div key={i} className="flex items-center justify-center w-5 h-5 bg-black/30 rounded">
              {day ? <OpponentBadge tricode={day.opponent} size="md" /> : <span className="text-[5px] text-white/30">—</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
