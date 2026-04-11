import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import PlayerCard from "./PlayerCard";
import React, { useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import courtBg from "@/assets/court-bg.png";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface RosterCourtViewProps {
  starters: PlayerListItem[];
  bench: PlayerListItem[];
  captainId: number;
  onPlayerClick: (id: number) => void;
  onSwap?: (playerId: number) => void;
  onDnDSwap?: (fromId: number, toId: number) => void;
}

/* Court formation positions (percentage-based).
   Row 1 (top / midcourt): 3 FC spots
   Row 2 (bottom / baseline): 2 BC spots */
const FC_POSITIONS = [
  { top: "12%", left: "50%"  },  // center FC
  { top: "28%", left: "22%" },  // left FC
  { top: "28%", left: "78%" },  // right FC
];
const BC_POSITIONS = [
  { top: "55%", left: "28%" },  // left BC
  { top: "55%", left: "72%" },  // right BC
];

function getFormationPositions(starters: PlayerListItem[]) {
  const fcs = starters.filter((p) => p.core.fc_bc === "FC");
  const bcs = starters.filter((p) => p.core.fc_bc === "BC");

  const positioned: { player: PlayerListItem; style: { top: string; left: string } }[] = [];

  // Place FCs
  fcs.forEach((p, i) => {
    if (i < FC_POSITIONS.length) {
      positioned.push({ player: p, style: FC_POSITIONS[i] });
    }
  });
  // Place BCs
  bcs.forEach((p, i) => {
    if (i < BC_POSITIONS.length) {
      positioned.push({ player: p, style: BC_POSITIONS[i] });
    }
  });

  // Any remaining players (overflow) fill remaining spots
  const usedIds = new Set(positioned.map((pp) => pp.player.core.id));
  const remaining = starters.filter((p) => !usedIds.has(p.core.id));
  const allSpots = [...FC_POSITIONS, ...BC_POSITIONS];
  const usedSpots = positioned.length;
  remaining.forEach((p, i) => {
    if (usedSpots + i < allSpots.length) {
      positioned.push({ player: p, style: allSpots[usedSpots + i] });
    }
  });

  return positioned;
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

  const formation = getFormationPositions(starters);

  const renderCard = (p: PlayerListItem, onCourt = false) => (
    <div
      key={p.core.id}
      className={dragOverId === p.core.id ? "ring-2 ring-accent ring-offset-1 rounded-sm" : ""}
    >
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
    <div className="flex flex-col md:flex-row gap-4">
      {/* LEFT — Court with Starting 5 */}
      <div className="flex-1">
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-sm mb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-destructive">Starting 5</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-body italic">Drag players to reorder</span>
        </div>
        <div
          className="relative w-full rounded-sm overflow-hidden"
          style={{
            aspectRatio: "3/5",
            backgroundImage: `url(${courtBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {formation.map(({ player, style }) => (
            <div
              key={player.core.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-[38%] md:w-[35%]"
              style={{ top: style.top, left: style.left }}
            >
              {renderCard(player, true)}
            </div>
          ))}
          {starters.length < 5 &&
            Array.from({ length: 5 - starters.length }).map((_, i) => {
              const allSpots = [...FC_POSITIONS, ...BC_POSITIONS];
              const spot = allSpots[starters.length + i];
              if (!spot) return null;
              return (
                <div
                  key={`empty-court-${i}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-[38%] md:w-[35%]"
                  style={{ top: spot.top, left: spot.left }}
                >
                  {emptySlot(i)}
                </div>
              );
            })}
        </div>
      </div>

      {/* RIGHT — Bench */}
      <div className="w-full md:w-[240px] lg:w-[260px] shrink-0">
        <div className="flex items-center justify-between bg-muted border border-border px-3 py-2 rounded-sm mb-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Bench</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-body italic">5 substitutes</span>
        </div>
        <div className="flex flex-col gap-2">
          {bench.map((p) => renderCard(p))}
          {bench.length < 5 && Array.from({ length: 5 - bench.length }).map((_, i) => emptySlot(i + 10))}
        </div>
      </div>
    </div>
  );
}
