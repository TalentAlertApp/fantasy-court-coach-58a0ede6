import { Badge } from "@/components/ui/badge";
import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import { ArrowLeftRight } from "lucide-react";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface PlayerCardProps {
  player: PlayerListItem;
  isCaptain?: boolean;
  onClick?: () => void;
  onSwap?: () => void;
}

export default function PlayerCard({ player, isCaptain, onClick, onSwap }: PlayerCardProps) {
  const { core, last5, computed } = player;
  return (
    <div
      onClick={onClick}
      className="bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow relative min-w-[140px] group"
    >
      {isCaptain && (
        <span className="absolute -top-2 -right-2 text-lg" title="Captain">⭐</span>
      )}
      {onSwap && (
        <button
          onClick={(e) => { e.stopPropagation(); onSwap(); }}
          className="absolute top-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground rounded-full p-1 hover:bg-primary/80 z-10"
          title="Swap player"
        >
          <ArrowLeftRight className="h-3 w-3" />
        </button>
      )}
      <div className="flex items-center gap-2 mb-2">
        {core.photo ? (
          <img src={core.photo} alt={core.name} className="w-10 h-10 rounded-full object-cover bg-muted" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
            {core.name.substring(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{core.name}</p>
          <p className="text-xs text-muted-foreground">{core.team}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <Badge variant={core.fc_bc === "FC" ? "destructive" : "default"} className="text-[10px] px-1.5 py-0">
          {core.fc_bc}
        </Badge>
        <span className="text-xs text-muted-foreground">${core.salary}</span>
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs">
        <div>
          <span className="text-muted-foreground">FP5</span>
          <span className="ml-1 font-medium">{last5.fp5.toFixed(1)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Val5</span>
          <span className="ml-1 font-medium">{computed.value5.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
