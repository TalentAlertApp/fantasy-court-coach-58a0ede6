import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import { ArrowLeftRight, GripVertical } from "lucide-react";
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
}

export default function PlayerCard({ player, isCaptain, onClick, onSwap, draggable, onDragStart, onDragOver, onDrop, onDragEnd }: PlayerCardProps) {
  const { core, last5, computed } = player;
  const accentColor = core.fc_bc === "FC" ? "bg-destructive" : "bg-primary";

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className="bg-card border rounded-sm cursor-pointer hover:border-accent transition-colors relative min-w-[130px] group"
    >
      {/* Team color accent strip */}
      <div className={`h-1 ${accentColor} rounded-t-sm`} />

      {isCaptain && (
        <span className="absolute -top-2 -right-2 text-base" title="Captain">⭐</span>
      )}

      {/* Drag handle */}
      {draggable && (
        <div className="absolute top-2 left-1 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}

      {onSwap && (
        <button
          onClick={(e) => { e.stopPropagation(); onSwap(); }}
          className="absolute top-2 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-accent text-accent-foreground rounded-sm p-1 hover:bg-accent/80 z-10"
          title="Swap player"
        >
          <ArrowLeftRight className="h-3 w-3" />
        </button>
      )}

      <div className="p-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          {core.photo ? (
            <img src={core.photo} alt={core.name} className="w-9 h-9 rounded-sm object-cover bg-muted" />
          ) : (
            <div className="w-9 h-9 rounded-sm bg-muted flex items-center justify-center text-[10px] font-heading font-bold text-muted-foreground">
              {core.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-heading font-bold uppercase truncate leading-tight">{core.name}</p>
            <p className="text-[10px] text-muted-foreground font-semibold">{core.team}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Badge variant={core.fc_bc === "FC" ? "destructive" : "default"} className="text-[9px] px-1.5 py-0 rounded-sm">
            {core.fc_bc}
          </Badge>
          <span className="text-[10px] text-muted-foreground font-mono">${core.salary}</span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <div>
            <span className="text-muted-foreground">FP5</span>
            <span className="ml-1 font-mono font-semibold">{last5.fp5.toFixed(1)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Val5</span>
            <span className="ml-1 font-mono font-semibold">{computed.value5.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
