import { Badge } from "@/components/ui/badge";
import { TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import { ArrowLeftRight } from "lucide-react";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface PlayerRowProps {
  player: PlayerListItem;
  onClick?: () => void;
  onSwap?: () => void;
  actionButton?: React.ReactNode;
}

export default function PlayerRow({ player, onClick, onSwap, actionButton }: PlayerRowProps) {
  const { core, last5, lastGame, computed } = player;
  return (
    <TableRow onClick={onClick} className="cursor-pointer hover:bg-accent/50">
      <TableCell>
        <div className="flex items-center gap-2">
          {core.photo ? (
            <img src={core.photo} alt={core.name} className="w-8 h-8 rounded-full object-cover bg-muted" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
              {core.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium">{core.name}</p>
            <p className="text-xs text-muted-foreground">{core.team}</p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={core.fc_bc === "FC" ? "destructive" : "default"} className="text-[10px]">
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
