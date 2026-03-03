import { Badge } from "@/components/ui/badge";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import { ArrowLeftRight, GripVertical } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import React from "react";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface PlayerRowProps {
  player: PlayerListItem;
  onClick?: () => void;
  onSwap?: () => void;
  actionButton?: React.ReactNode;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export default function PlayerRow({ player, onClick, onSwap, actionButton, draggable, onDragStart, onDragOver, onDrop, onDragEnd }: PlayerRowProps) {
  const { core, last5, lastGame, computed } = player;
  const teamLogo = getTeamLogo(core.team);

  return (
    <TableRow
      onClick={onClick}
      className="cursor-pointer hover:bg-muted/50 group"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <TableCell>
        <div className="flex items-center gap-2">
          {draggable && (
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing flex-shrink-0" />
          )}
          {teamLogo && (
            <img src={teamLogo} alt={core.team} className="w-5 h-5 flex-shrink-0 opacity-60" />
          )}
          {core.photo ? (
            <img src={core.photo} alt={core.name} className="w-7 h-7 rounded-sm object-cover bg-muted" />
          ) : (
            <div className="w-7 h-7 rounded-sm bg-muted flex items-center justify-center text-[9px] font-heading font-bold text-muted-foreground">
              {core.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-heading font-semibold uppercase leading-tight">{core.name}</p>
            <p className="text-[10px] text-muted-foreground">{core.team}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={core.fc_bc === "FC" ? "destructive" : "default"} className="text-[9px] rounded-sm">
          {core.fc_bc}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono text-sm">${core.salary}</TableCell>
      <TableCell className="text-right font-mono text-sm">{last5.fp5.toFixed(1)}</TableCell>
      <TableCell className="text-right font-mono text-sm">{computed.value5.toFixed(2)}</TableCell>
      <TableCell className="text-right font-mono text-sm">{lastGame.fp.toFixed(1)}</TableCell>
      <TableCell className="text-right">
        {onSwap && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onSwap(); }}
            title="Swap player"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </Button>
        )}
        {actionButton}
      </TableCell>
    </TableRow>
  );
}
