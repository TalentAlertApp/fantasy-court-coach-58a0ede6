import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import PlayerCard from "./PlayerCard";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface RosterCourtViewProps {
  starters: PlayerListItem[];
  bench: PlayerListItem[];
  captainId: number;
  onPlayerClick: (id: number) => void;
}

export default function RosterCourtView({ starters, bench, captainId, onPlayerClick }: RosterCourtViewProps) {
  return (
    <div className="space-y-6">
      {/* Starters */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-nba-red mb-3">Starting 5</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {starters.map((p) => (
            <PlayerCard
              key={p.core.id}
              player={p}
              isCaptain={p.core.id === captainId}
              onClick={() => onPlayerClick(p.core.id)}
            />
          ))}
          {starters.length === 0 && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-muted border border-dashed rounded-lg p-6 flex items-center justify-center text-muted-foreground text-xs">
              Empty
            </div>
          ))}
        </div>
      </div>

      {/* Bench */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-primary mb-3">Bench</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {bench.map((p) => (
            <PlayerCard
              key={p.core.id}
              player={p}
              onClick={() => onPlayerClick(p.core.id)}
            />
          ))}
          {bench.length === 0 && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-muted border border-dashed rounded-lg p-6 flex items-center justify-center text-muted-foreground text-xs">
              Empty
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
