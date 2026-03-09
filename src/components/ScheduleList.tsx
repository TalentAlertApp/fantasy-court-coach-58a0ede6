import { useState } from "react";
import { z } from "zod";
import { ScheduleGameSchema } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { getTeamLogo } from "@/lib/nba-teams";
import { useGameBoxscoreQuery } from "@/hooks/useGameBoxscoreQuery";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown } from "lucide-react";
import PlayerModal from "@/components/PlayerModal";

type ScheduleGame = z.infer<typeof ScheduleGameSchema>;

interface ScheduleListProps {
  games: ScheduleGame[];
}

function GameBoxScore({ gameId, onPlayerClick }: { gameId: string; onPlayerClick: (playerId: number) => void }) {
  const { data, isLoading } = useGameBoxscoreQuery(gameId);

  if (isLoading) {
    return <div className="p-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>;
  }

  const players = data?.players ?? [];
  if (players.length === 0) {
    return <p className="p-3 text-sm text-muted-foreground">No player data available</p>;
  }

  return (
    <div className="border-t bg-muted/30">
      {/* Header */}
      <div className="grid grid-cols-[1fr_repeat(7,40px)] gap-1 px-3 py-1.5 text-[10px] font-heading uppercase text-muted-foreground border-b">
        <span>Player</span>
        <span className="text-center">PTS</span>
        <span className="text-center">MP</span>
        <span className="text-center">PS</span>
        <span className="text-center">A</span>
        <span className="text-center">R</span>
        <span className="text-center">B</span>
        <span className="text-center">S</span>
      </div>
      {/* Rows */}
      {players.map((p) => (
        <div
          key={p.player_id}
          onClick={() => onPlayerClick(p.player_id)}
          className="grid grid-cols-[1fr_repeat(7,40px)] gap-1 px-3 py-1.5 text-sm items-center border-b border-border/50 last:border-b-0 cursor-pointer hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6 shrink-0">
              {p.photo && <AvatarImage src={p.photo} alt={p.name} />}
              <AvatarFallback className="text-[9px]">{p.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 rounded-sm font-heading">
              {p.fc_bc}
            </Badge>
            <span className="truncate text-xs font-medium">{p.name}</span>
          </div>
          <span className="text-center font-mono text-xs font-bold">{p.fp}</span>
          <span className="text-center font-mono text-xs text-muted-foreground">{p.mp}</span>
          <span className="text-center font-mono text-xs">{p.ps}</span>
          <span className="text-center font-mono text-xs">{p.ast}</span>
          <span className="text-center font-mono text-xs">{p.reb}</span>
          <span className="text-center font-mono text-xs">{p.blk}</span>
          <span className="text-center font-mono text-xs">{p.stl}</span>
        </div>
      ))}
    </div>
  );
}

export default function ScheduleList({ games }: ScheduleListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  if (games.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-heading uppercase">No Games Scheduled</p>
        <p className="text-sm font-body">Try navigating to a different day</p>
      </div>
    );
  }

  return (
    <div className="border rounded-sm overflow-hidden">
      {games.map((g, i) => {
        const isFinal = g.status === "FINAL";
        const isExpanded = expandedId === g.game_id;

        return (
          <Collapsible
            key={g.game_id}
            open={isExpanded}
            onOpenChange={() => isFinal && setExpandedId(isExpanded ? null : g.game_id)}
          >
            <CollapsibleTrigger asChild disabled={!isFinal}>
              <div
                className={`bg-card flex items-center justify-between px-4 py-3 ${i < games.length - 1 && !isExpanded ? "border-b" : ""} ${isFinal ? "cursor-pointer hover:bg-accent/50 transition-colors" : ""}`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-2 text-right min-w-[90px] justify-end">
                    {getTeamLogo(g.away_team) && <img src={getTeamLogo(g.away_team)} alt={g.away_team} className="w-5 h-5" />}
                    <div>
                      <p className="font-heading font-bold text-sm uppercase">{g.away_team}</p>
                      {isFinal && <p className="text-lg font-mono font-bold">{g.away_pts}</p>}
                    </div>
                  </div>
                  <span className="text-muted-foreground text-xs font-heading">@</span>
                  <div className="flex items-center gap-2 min-w-[90px]">
                    {getTeamLogo(g.home_team) && <img src={getTeamLogo(g.home_team)} alt={g.home_team} className="w-5 h-5" />}
                    <div>
                      <p className="font-heading font-bold text-sm uppercase">{g.home_team}</p>
                      {isFinal && <p className="text-lg font-mono font-bold">{g.home_pts}</p>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isFinal ? "secondary" : "outline"} className="text-[10px] rounded-sm font-heading">
                    {g.status}
                  </Badge>
                  {g.tipoff_utc && (
                    <span className="text-xs font-mono border border-border px-1.5 py-0.5 rounded-sm">
                      {new Date(g.tipoff_utc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                  {isFinal && (
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  )}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {isExpanded && <GameBoxScore gameId={g.game_id} onPlayerClick={setSelectedPlayerId} />}
            </CollapsibleContent>
            {(i < games.length - 1 && isExpanded) && <div className="border-b" />}
          </Collapsible>
        );
      })}
      
      <PlayerModal
        playerId={selectedPlayerId}
        open={selectedPlayerId !== null}
        onOpenChange={(open) => !open && setSelectedPlayerId(null)}
      />
    </div>
  );
}
