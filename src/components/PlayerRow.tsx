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
  const totalFp = (player.season as any)?.total_fp ?? ((player.season as any)?.fp ?? 0) * (player.season?.gp ?? 0);

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
          {core.photo ? (
            <img src={core.photo} alt={core.name} className="w-10 h-10 rounded-lg object-cover bg-muted" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-[10px] font-heading font-bold text-muted-foreground">
              {core.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-heading font-semibold uppercase leading-tight">{core.name}</p>
            <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <span>{core.team}</span>
              {teamLogo && <img src={teamLogo} alt={core.team} className="w-4 h-4" />}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center w-16 font-mono text-xs text-muted-foreground">{core.height ?? "—"}</TableCell>
      <TableCell className="w-32 text-xs text-muted-foreground truncate max-w-[8rem]" title={core.college ?? undefined}>
        {core.college ?? "—"}
      </TableCell>
      <TableCell className="text-center w-20">
        <Badge variant={core.fc_bc === "FC" ? "destructive" : "default"} className="text-[9px] rounded-lg">
          {core.fc_bc}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono text-sm w-24">${core.salary}</TableCell>
      <TableCell className="text-right font-mono text-sm w-24">{last5.fp5.toFixed(1)}</TableCell>
      <TableCell className="text-right font-mono text-sm w-24">{computed.value5.toFixed(2)}</TableCell>
      <TableCell className="text-right font-mono text-sm w-24">{lastGame.fp.toFixed(1)}</TableCell>
      <TableCell className="text-right font-mono text-sm w-24 font-bold">{Number(totalFp).toFixed(0)}</TableCell>
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
