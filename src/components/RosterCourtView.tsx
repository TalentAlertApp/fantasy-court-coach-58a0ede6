import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import PlayerCard from "./PlayerCard";
import React, { useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import courtBg from "@/assets/court-bg.png";
import type { UpcomingByTeam } from "@/hooks/useUpcomingByTeam";
import { getTeamUpcoming } from "@/hooks/useUpcomingByTeam";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface RosterCourtViewProps {
  starters: PlayerListItem[];
  bench: PlayerListItem[];
  captainId: number;
  onPlayerClick: (id: number) => void;
  onSwap?: (playerId: number) => void;
  onDnDSwap?: (fromId: number, toId: number) => void;
  upcomingByTeam?: UpcomingByTeam;
}

/* Landscape court positions — FC at top (near basket), BC at bottom (perimeter) */
function getRowPositions(count: number, topPct: string): { top: string; left: string }[] {
  if (count === 3) {
    return [
      { top: topPct, left: "20%" },
      { top: topPct, left: "50%" },
      { top: topPct, left: "80%" },
    ];
  }
  return [
    { top: topPct, left: "33%" },
    { top: topPct, left: "67%" },
  ];
}

function getFormationPositions(starters: PlayerListItem[]) {
  const fcs = starters.filter((p) => p.core.fc_bc === "FC");
  const bcs = starters.filter((p) => p.core.fc_bc === "BC");

  const fcPositions = getRowPositions(fcs.length, "28%");
  const bcPositions = getRowPositions(bcs.length, "72%");

  const positioned: { player: PlayerListItem; style: { top: string; left: string } }[] = [];

  fcs.forEach((p, i) => {
    if (i < fcPositions.length) positioned.push({ player: p, style: fcPositions[i] });
  });
  bcs.forEach((p, i) => {
    if (i < bcPositions.length) positioned.push({ player: p, style: bcPositions[i] });
  });

  // Overflow fallback
  const usedIds = new Set(positioned.map((pp) => pp.player.core.id));
  const remaining = starters.filter((p) => !usedIds.has(p.core.id));
  const allSpots = [...fcPositions, ...bcPositions];
  remaining.forEach((p, i) => {
    const idx = positioned.length + i;
    if (idx < allSpots.length) positioned.push({ player: p, style: allSpots[idx] });
  });

  return positioned;
}

export default function RosterCourtView({ starters, bench, captainId, onPlayerClick, onSwap, onDnDSwap, upcomingByTeam }: RosterCourtViewProps) {
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
    if (sourceId && sourceId !== targetId && onDnDSwap) onDnDSwap(sourceId, targetId);
  };

  const handleDragEnd = () => setDragOverId(null);

  const formation = getFormationPositions(starters);

  const renderCard = (p: PlayerListItem, compact: boolean) => (
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
        compact={compact}
        upcoming={getTeamUpcoming(upcomingByTeam, p.core.team)}
      />
    </div>
  );

  const emptySlot = (i: number) => (
    <div key={`empty-${i}`} className="bg-muted/50 border-2 border-dashed border-muted-foreground/20 rounded-sm p-3 flex items-center justify-center text-muted-foreground/40 text-[10px] font-heading uppercase tracking-wider">
      Empty
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Court with Starting 5 */}
      <div className="w-full">
        <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-lg mb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-destructive">Starting 5</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-body italic">Drag to reorder</span>
        </div>
        <div
          className="relative w-full rounded-lg overflow-hidden"
          style={{
            aspectRatio: "5/3",
            backgroundImage: `url(${courtBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {formation.map(({ player, style }) => (
            <div
              key={player.core.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-[17%] md:w-[15%] lg:w-[14%]"
              style={{ top: style.top, left: style.left }}
            >
              {renderCard(player, true)}
            </div>
          ))}
          {starters.length < 5 &&
            Array.from({ length: 5 - starters.length }).map((_, i) => {
              const fcs = starters.filter((p) => p.core.fc_bc === "FC");
              const bcs = starters.filter((p) => p.core.fc_bc === "BC");
              const fcPos = getRowPositions(fcs.length || 2, "28%");
              const bcPos = getRowPositions(bcs.length || 2, "72%");
              const allSpots = [...fcPos, ...bcPos];
              const spot = allSpots[starters.length + i];
              if (!spot) return null;
              return (
                <div
                  key={`empty-court-${i}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-[17%] md:w-[15%] lg:w-[14%]"
                  style={{ top: spot.top, left: spot.left }}
                >
                  {emptySlot(i)}
                </div>
              );
            })}
        </div>
      </div>

      {/* Bench — horizontal row below court */}
      <div>
        <div className="flex items-center justify-between bg-muted border border-border px-3 py-2 rounded-lg mb-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-muted-foreground">Bench</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-body italic">5 subs</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {bench.map((p) => renderCard(p, true))}
          {bench.length < 5 && Array.from({ length: 5 - bench.length }).map((_, i) => emptySlot(i + 10))}
        </div>
      </div>
    </div>
  );
}
