import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PlayerRow from "./PlayerRow";
import React, { useState } from "react";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface RosterListViewProps {
  starters: PlayerListItem[];
  bench: PlayerListItem[];
  onPlayerClick: (id: number) => void;
  onSwap?: (playerId: number) => void;
  onDnDSwap?: (fromId: number, toId: number) => void;
}

export default function RosterListView({ starters, bench, onPlayerClick, onSwap, onDnDSwap }: RosterListViewProps) {
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

  const header = (
    <TableHeader>
      <TableRow>
        <TableHead>Player</TableHead>
        <TableHead>FC/BC</TableHead>
        <TableHead className="text-right">Salary</TableHead>
        <TableHead className="text-right">FP5</TableHead>
        <TableHead className="text-right">Value5</TableHead>
        <TableHead className="text-right">Last FP</TableHead>
        <TableHead className="text-right w-10"></TableHead>
      </TableRow>
    </TableHeader>
  );

  const renderRow = (p: PlayerListItem) => (
    <PlayerRow
      key={p.core.id}
      player={p}
      onClick={() => onPlayerClick(p.core.id)}
      onSwap={onSwap ? () => onSwap(p.core.id) : undefined}
      draggable
      onDragStart={(e) => handleDragStart(e, p.core.id)}
      onDragOver={(e) => handleDragOver(e, p.core.id)}
      onDrop={(e) => handleDrop(e, p.core.id)}
      onDragEnd={handleDragEnd}
    />
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="section-bar mb-1 rounded-sm">STARTING 5</div>
        <Table>{header}
          <TableBody>{starters.map(renderRow)}</TableBody>
        </Table>
      </div>
      <div>
        <div className="section-bar mb-1 rounded-sm">BENCH</div>
        <Table>{header}
          <TableBody>{bench.map(renderRow)}</TableBody>
        </Table>
      </div>
    </div>
  );
}
