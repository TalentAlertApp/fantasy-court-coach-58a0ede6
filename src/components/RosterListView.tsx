import { z } from "zod";
import { PlayerListItemSchema } from "@/lib/contracts";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PlayerRow from "./PlayerRow";

type PlayerListItem = z.infer<typeof PlayerListItemSchema>;

interface RosterListViewProps {
  starters: PlayerListItem[];
  bench: PlayerListItem[];
  onPlayerClick: (id: number) => void;
  onSwap?: (playerId: number) => void;
}

export default function RosterListView({ starters, bench, onPlayerClick, onSwap }: RosterListViewProps) {
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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-nba-red mb-2">Starting 5</h3>
        <Table>{header}
          <TableBody>
            {starters.map((p) => (
              <PlayerRow
                key={p.core.id}
                player={p}
                onClick={() => onPlayerClick(p.core.id)}
                onSwap={onSwap ? () => onSwap(p.core.id) : undefined}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-primary mb-2">Bench</h3>
        <Table>{header}
          <TableBody>
            {bench.map((p) => (
              <PlayerRow
                key={p.core.id}
                player={p}
                onClick={() => onPlayerClick(p.core.id)}
                onSwap={onSwap ? () => onSwap(p.core.id) : undefined}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
