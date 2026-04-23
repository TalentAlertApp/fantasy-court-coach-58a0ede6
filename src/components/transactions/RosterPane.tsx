import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getTeamLogo } from "@/lib/nba-teams";
import { Minus } from "lucide-react";

export interface RosterPanePlayer {
  player_id: number;
  name: string;
  team: string;
  salary: number;
  fc_bc: string;
  photo: string | null;
}

interface RosterPaneProps {
  starters: RosterPanePlayer[];
  bench: RosterPanePlayer[];
  outZone: number[];
  isLoading?: boolean;
  onToggleOut: (id: number) => void;
  onPlayerClick: (id: number) => void;
}

function RosterRow({
  player,
  isOut,
  onToggleOut,
  onPlayerClick,
}: {
  player: RosterPanePlayer;
  isOut: boolean;
  onToggleOut: (id: number) => void;
  onPlayerClick: (id: number) => void;
}) {
  const teamLogo = getTeamLogo(player.team);
  return (
    <div
      onClick={() => onPlayerClick(player.player_id)}
      className={`group flex items-center gap-1.5 px-1.5 py-1 rounded-md cursor-pointer transition-colors ${
        isOut
          ? "bg-destructive/15 ring-1 ring-destructive/40"
          : "hover:bg-accent/30"
      }`}
    >
      <Avatar className="h-7 w-7 shrink-0 rounded-full">
        {player.photo && <AvatarImage src={player.photo} />}
        <AvatarFallback className="text-[8px]">{player.name.slice(0, 2)}</AvatarFallback>
      </Avatar>
      {teamLogo && <img src={teamLogo} alt="" className="w-3.5 h-3.5 shrink-0" />}
      <Badge
        variant={player.fc_bc === "FC" ? "destructive" : "default"}
        className="text-[7px] px-0.5 py-0 rounded-md shrink-0"
      >
        {player.fc_bc}
      </Badge>
      <span className="text-xs font-medium truncate flex-1 min-w-0">{player.name}</span>
      <span className="text-[10px] font-mono text-muted-foreground shrink-0">${player.salary}</span>
      <Button
        variant="ghost"
        size="icon"
        className={`h-5 w-5 shrink-0 ${
          isOut ? "text-destructive bg-destructive/20" : "text-destructive hover:bg-destructive/10"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleOut(player.player_id);
        }}
        title={isOut ? "Cancel release" : "Stage for release"}
      >
        <Minus className="h-3 w-3" />
      </Button>
    </div>
  );
}

export default function RosterPane({
  starters,
  bench,
  outZone,
  isLoading,
  onToggleOut,
  onPlayerClick,
}: RosterPaneProps) {
  const empty = !isLoading && starters.length === 0 && bench.length === 0;

  return (
    <div className="w-64 shrink-0 flex flex-col gap-3 overflow-y-auto pr-1">
      <div>
        <div className="section-bar mb-1 rounded-lg">STARTING 5</div>
        <div className="flex flex-col gap-0.5">
          {isLoading && starters.length === 0
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-md" />)
            : starters.map((p) => (
                <RosterRow
                  key={p.player_id}
                  player={p}
                  isOut={outZone.includes(p.player_id)}
                  onToggleOut={onToggleOut}
                  onPlayerClick={onPlayerClick}
                />
              ))}
        </div>
      </div>
      <div>
        <div className="section-bar mb-1 rounded-lg">BENCH</div>
        <div className="flex flex-col gap-0.5">
          {isLoading && bench.length === 0
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-md" />)
            : bench.map((p) => (
                <RosterRow
                  key={p.player_id}
                  player={p}
                  isOut={outZone.includes(p.player_id)}
                  onToggleOut={onToggleOut}
                  onPlayerClick={onPlayerClick}
                />
              ))}
        </div>
      </div>
      {empty && (
        <div className="text-xs text-muted-foreground italic px-2">Roster loading…</div>
      )}
    </div>
  );
}