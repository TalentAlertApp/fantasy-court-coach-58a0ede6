import { useState } from "react";
import { z } from "zod";
import { ScheduleGameSchema } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { getTeamLogo } from "@/lib/nba-teams";
import { useGameBoxscoreQuery } from "@/hooks/useGameBoxscoreQuery";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ExternalLink } from "lucide-react";
import PlayerModal from "@/components/PlayerModal";

type ScheduleGame = z.infer<typeof ScheduleGameSchema>;

interface ScheduleListProps {
  games: ScheduleGame[];
}

/** Format tipoff in Lisbon timezone */
function formatTipoff(utc: string): string {
  const d = new Date(utc);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Get status color for left border */
function getStatusBorder(status: string): string {
  switch (status) {
    case "FINAL": return "border-l-green-500";
    case "LIVE": case "IN_PROGRESS": return "border-l-[hsl(var(--nba-yellow))]";
    default: return "border-l-transparent";
  }
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
    <div className="border-t bg-muted/20">
      {/* Header */}
      <div className="grid grid-cols-[1fr_repeat(7,36px)] gap-1 px-3 py-1.5 text-[10px] font-heading uppercase text-muted-foreground border-b bg-muted/40">
        <span>Player</span>
        <span className="text-center">FP</span>
        <span className="text-center">MP</span>
        <span className="text-center">PS</span>
        <span className="text-center">A</span>
        <span className="text-center">R</span>
        <span className="text-center">B</span>
        <span className="text-center">S</span>
      </div>
      {/* Scrollable rows — max 10 visible */}
      <div className="max-h-[360px] overflow-y-auto">
        {players.map((p) => {
          const isFc = p.fc_bc === "FC";
          return (
            <div
              key={p.player_id}
              onClick={() => onPlayerClick(p.player_id)}
              className="grid grid-cols-[1fr_repeat(7,36px)] gap-1 px-3 py-1.5 text-sm items-center border-b border-border/40 last:border-b-0 cursor-pointer hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-6 w-6 shrink-0">
                  {p.photo && <AvatarImage src={p.photo} alt={p.name} />}
                  <AvatarFallback className="text-[9px]">{p.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <Badge
                  variant={isFc ? "destructive" : "default"}
                  className="text-[8px] px-1 py-0 shrink-0 rounded-sm font-heading min-w-[22px] justify-center"
                >
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
          );
        })}
      </div>
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
    <div className="space-y-1.5 px-1">
      {games.map((g) => {
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
                className={`bg-card rounded-sm border border-l-4 ${getStatusBorder(g.status)} flex items-center justify-between px-4 py-3 ${
                  isFinal ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""
                } ${isExpanded ? "rounded-b-none border-b-0" : ""}`}
              >
                {/* Teams */}
                <div className="flex items-center gap-4 flex-1">
                  {/* Away */}
                  <div className="flex items-center gap-2.5 min-w-[110px] justify-end text-right">
                    <div>
                      <p className="font-heading font-bold text-sm uppercase leading-tight">{g.away_team}</p>
                      {isFinal && <p className="text-xl font-mono font-black leading-tight">{g.away_pts}</p>}
                    </div>
                    {getTeamLogo(g.away_team) && (
                      <img src={getTeamLogo(g.away_team)} alt={g.away_team} className="w-8 h-8" />
                    )}
                  </div>

                  {/* VS / @ */}
                  <div className="flex flex-col items-center">
                    <span className="text-muted-foreground text-[10px] font-heading font-bold">@</span>
                  </div>

                  {/* Home */}
                  <div className="flex items-center gap-2.5 min-w-[110px]">
                    {getTeamLogo(g.home_team) && (
                      <img src={getTeamLogo(g.home_team)} alt={g.home_team} className="w-8 h-8" />
                    )}
                    <div>
                      <p className="font-heading font-bold text-sm uppercase leading-tight">{g.home_team}</p>
                      {isFinal && <p className="text-xl font-mono font-black leading-tight">{g.home_pts}</p>}
                    </div>
                  </div>
                </div>

                {/* Right info */}
                <div className="flex items-center gap-2">
                  <Badge
                    variant={isFinal ? "secondary" : "outline"}
                    className={`text-[10px] rounded-sm font-heading ${
                      isFinal ? "bg-green-500/10 text-green-700 border-green-500/30" : ""
                    }`}
                  >
                    {g.status}
                  </Badge>
                  {g.tipoff_utc && (
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded-sm font-bold">
                      {formatTipoff(g.tipoff_utc)}
                    </span>
                  )}
                  {g.nba_game_url && (
                    <a
                      href={g.nba_game_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {isFinal && (
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  )}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-card border border-t-0 border-l-4 border-l-green-500 rounded-b-sm overflow-hidden">
                {isExpanded && <GameBoxScore gameId={g.game_id} onPlayerClick={setSelectedPlayerId} />}
              </div>
            </CollapsibleContent>
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
