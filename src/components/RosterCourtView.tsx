import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import PlayerCard from "./PlayerCard";
import React, { useState } from "react";
import { AlertTriangle, Users } from "lucide-react";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface RosterCourtViewProps {
  starters: PlayerListItem[];
  bench: PlayerListItem[];
  captainId: number;
  onPlayerClick: (id: number) => void;
  onSwap?: (playerId: number) => void;
  onDnDSwap?: (fromId: number, toId: number) => void;
}

export default function RosterCourtView({ starters, bench, captainId, onPlayerClick, onSwap, onDnDSwap }: RosterCourtViewProps) {
  const [dragOverId, setDragOverId] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, playerId: number) => {
    e.dataTransfer.setData("text/plain", String(playerId));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, playerId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(playerId);
  };

  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    setDragOverId(null);
    const sourceId = Number(e.dataTransfer.getData("text/plain"));
    if (sourceId && sourceId !== targetId && onDnDSwap) {
      onDnDSwap(sourceId, targetId);
    }
  };

  const handleDragEnd = () => setDragOverId(null);

  const renderCard = (p: PlayerListItem) => (
    <div key={p.core.id} className={dragOverId === p.core.id ? "ring-2 ring-accent ring-offset-1 rounded-sm" : ""}>
      <PlayerCard
        player={p}
        isCaptain={p.core.id === captainId}
        onClick={() => onPlayerClick(p.core.id)}
        onSwap={onSwap ? () => onSwap(p.core.id) : undefined}
        draggable
        onDragStart={(e) => handleDragStart(e, p.core.id)}
        onDragOver={(e) => handleDragOver(e, p.core.id)}
        onDrop={(e) => handleDrop(e, p.core.id)}
        onDragEnd={handleDragEnd}
      />
    </div>
  );

  const emptySlot = (i: number) => (
    <div key={`empty-${i}`} className="bg-muted/50 border-2 border-dashed border-muted-foreground/20 rounded-sm p-6 flex items-center justify-center text-muted-foreground/40 text-[10px] font-heading uppercase tracking-wider">
      Empty
    </div>
  );

  return (
    <div className="space-y-4">
      {/* STARTING 5 */}
      <div>
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-sm mb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-destructive">Starting 5</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-body italic">Drag players to reorder positions</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {starters.map(renderCard)}
          {starters.length < 5 && Array.from({ length: 5 - starters.length }).map((_, i) => emptySlot(i))}
        </div>
      </div>

      {/* BENCH */}
      <div>
        <div className="flex items-center justify-between bg-muted border border-border px-3 py-2 rounded-sm mb-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Bench</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-body italic">5 substitutes</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {bench.map(renderCard)}
          {bench.length < 5 && Array.from({ length: 5 - bench.length }).map((_, i) => emptySlot(i + 10))}
        </div>
      </div>
    </div>
  );
}
