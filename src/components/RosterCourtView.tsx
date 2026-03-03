import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import PlayerCard from "./PlayerCard";
import React, { useState } from "react";

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

  return (
    <div className="space-y-4">
      <div>
        <div className="section-bar mb-2 rounded-sm">STARTING 5</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {starters.map(renderCard)}
          {starters.length === 0 && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-muted border border-dashed rounded-sm p-6 flex items-center justify-center text-muted-foreground text-xs font-heading uppercase">
              Empty
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="section-bar mb-2 rounded-sm">BENCH</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {bench.map(renderCard)}
          {bench.length === 0 && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-muted border border-dashed rounded-sm p-6 flex items-center justify-center text-muted-foreground text-xs font-heading uppercase">
              Empty
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
