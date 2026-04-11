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

function OpponentBadge({ tricode }: { tricode: string }) {
  const logo = getTeamLogo(tricode);
  return logo ? (
    <img src={logo} alt={tricode} className="w-3.5 h-3.5 object-contain" title={tricode} />
  ) : (
    <span className="text-[6px] font-bold text-muted-foreground">{tricode}</span>
  );
}

export default function PlayerCard({
  player, isCaptain, onClick, onSwap, draggable,
  onDragStart, onDragOver, onDrop, onDragEnd, compact, upcoming,
}: PlayerCardProps) {
  const { core, last5, computed } = player;
  const isFc = core.fc_bc === "FC";
  const accentColor = isFc ? "border-destructive" : "border-primary";
  const teamLogo = getTeamLogo(core.team);

  // Next game = upcoming[0], upcoming days = upcoming[1..6]
  const nextGame = upcoming?.[0] ?? null;
  const upcomingDays = upcoming?.slice(1, 7) ?? [];

  if (compact) {
    return (
      <div
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onClick={onClick}
        className={`bg-card/95 backdrop-blur-sm border-t-2 ${accentColor} rounded-lg cursor-pointer hover:ring-1 hover:ring-accent transition-all relative group overflow-hidden`}
        style={{ minWidth: 0 }}
      >
        {isCaptain && <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs z-10" title="Captain">⭐</span>}

        {/* Drag handle */}
        {draggable && (
          <div className="absolute top-0.5 left-0.5 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing z-10">
            <GripVertical className="h-2.5 w-2.5 text-muted-foreground" />
          </div>
        )}

        {/* Swap button */}
        {onSwap && (
          <button
            onClick={(e) => { e.stopPropagation(); onSwap(); }}
            className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-accent text-accent-foreground rounded-sm p-0.5 hover:bg-accent/80 z-10"
            title="Swap player"
          >
            <ArrowLeftRight className="h-2.5 w-2.5" />
          </button>
        )}

        {/* Header: team logo + tricode */}
        <div className="flex items-center justify-between px-1 pt-0.5">
          <div className="flex items-center gap-0.5">
            {teamLogo && <img src={teamLogo} alt={core.team} className="w-3 h-3" />}
          </div>
          <span className="text-[7px] font-heading font-bold text-muted-foreground">{core.team}</span>
        </div>

        {/* Photo */}
        <div className="flex justify-center py-0.5">
          {core.photo ? (
            <img src={core.photo} alt={core.name} className="w-8 h-8 rounded-full object-cover bg-muted" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[8px] font-heading font-bold text-muted-foreground">
              {core.name.substring(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Name */}
        <p className="text-[8px] font-heading font-bold text-center truncate px-0.5 leading-tight">
          {formatShortName(core.name)}
        </p>

        {/* FC/BC badge + salary */}
        <div className="flex items-center justify-center gap-1 py-0.5">
          <Badge variant={isFc ? "destructive" : "default"} className="text-[6px] px-1 py-0 rounded-sm h-3">
            {core.fc_bc}
          </Badge>
          <span className="text-[7px] text-muted-foreground font-mono">${core.salary}</span>
        </div>

        {/* Next opponent */}
        {upcoming && (
          <div className="border-t border-border/50 px-1 py-0.5 flex items-center justify-between">
            <span className="text-[6px] font-heading font-bold text-muted-foreground uppercase">Next</span>
            {nextGame ? <OpponentBadge tricode={nextGame.opponent} /> : <span className="text-[6px] text-muted-foreground">—</span>}
          </div>
        )}

        {/* Upcoming 6 days */}
        {upcoming && upcomingDays.length > 0 && (
          <div className="border-t border-border/50 px-0.5 py-0.5">
            <div className="grid grid-cols-6 gap-0">
              {upcomingDays.map((day, i) => (
                <div key={i} className="flex items-center justify-center h-3.5">
                  {day ? <OpponentBadge tricode={day.opponent} /> : <span className="text-[5px] text-muted-foreground/40">—</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Non-compact (bench) - same layout as compact but slightly larger
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`bg-card/95 backdrop-blur-sm border-t-2 ${accentColor} rounded-lg cursor-pointer hover:ring-1 hover:ring-accent transition-all relative group overflow-hidden`}
    >
      {isCaptain && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-sm z-10" title="Captain">⭐</span>}

      {draggable && (
        <div className="absolute top-1 left-0.5 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing z-10">
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
      )}

      {onSwap && (
        <button
          onClick={(e) => { e.stopPropagation(); onSwap(); }}
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-accent text-accent-foreground rounded-sm p-0.5 hover:bg-accent/80 z-10"
          title="Swap player"
        >
          <ArrowLeftRight className="h-3 w-3" />
        </button>
      )}

      {/* Header: team logo + tricode */}
      <div className="flex items-center justify-between px-2 pt-1.5">
        <div className="flex items-center gap-1">
          {teamLogo && <img src={teamLogo} alt={core.team} className="w-4 h-4" />}
        </div>
        <span className="text-[9px] font-heading font-bold text-muted-foreground">{core.team}</span>
      </div>

      {/* Photo */}
      <div className="flex justify-center py-1">
        {core.photo ? (
          <img src={core.photo} alt={core.name} className="w-12 h-12 rounded-full object-cover bg-muted" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-xs font-heading font-bold text-muted-foreground">
            {core.name.substring(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Name */}
      <p className="text-[10px] font-heading font-bold text-center truncate px-1 leading-tight">
        {formatShortName(core.name)}
      </p>

      {/* FC/BC badge + salary */}
      <div className="flex items-center justify-center gap-1.5 py-1">
        <Badge variant={isFc ? "destructive" : "default"} className="text-[8px] px-1.5 py-0 rounded-sm">
          {core.fc_bc}
        </Badge>
        <span className="text-[9px] text-muted-foreground font-mono">${core.salary}</span>
      </div>

      {/* Next opponent */}
      {upcoming && (
        <div className="border-t border-border/50 px-2 py-1 flex items-center justify-between">
          <span className="text-[8px] font-heading font-bold text-muted-foreground uppercase">Next</span>
          {nextGame ? <OpponentBadge tricode={nextGame.opponent} /> : <span className="text-[8px] text-muted-foreground">—</span>}
        </div>
      )}

      {/* Upcoming 6 days */}
      {upcoming && upcomingDays.length > 0 && (
        <div className="border-t border-border/50 px-1 py-1">
          <p className="text-[7px] font-heading text-center text-muted-foreground uppercase mb-0.5">Upcoming</p>
          <div className="grid grid-cols-6 gap-0.5">
            {upcomingDays.map((day, i) => (
              <div key={i} className="flex items-center justify-center h-4">
                {day ? <OpponentBadge tricode={day.opponent} /> : <span className="text-[7px] text-muted-foreground/40">—</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
