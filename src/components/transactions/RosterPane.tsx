import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getTeamLogo } from "@/lib/nba-teams";
import { Minus } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";
import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";
import { HealthStatusIcon } from "@/components/health";
import type { PlayerHealth } from "@/lib/health";
import { isHealthUnavailable, isHealthRisky } from "@/lib/health";

export interface RosterPanePlayer {
  player_id: number;
  name: string;
  team: string;
  salary: number;
  fc_bc: string;
  photo: string | null;
  health?: PlayerHealth | null;
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
  const out = isHealthUnavailable(player.health);
  const risk = isHealthRisky(player.health);
  return (
    <div
      onClick={() => onPlayerClick(player.player_id)}
      className={`group relative overflow-hidden flex items-center px-1.5 py-1.5 rounded-md cursor-pointer transition-colors ${
        isOut
          ? "bg-destructive/15 ring-1 ring-destructive/40"
          : out
            ? "bg-red-500/5 ring-1 ring-red-500/30"
            : risk
              ? "bg-amber-500/5 ring-1 ring-amber-500/25"
          : "hover:bg-accent/30"
      }`}
    >
      {teamLogo && (
        <img
          src={teamLogo}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2 h-14 w-14 object-contain opacity-[0.20] rotate-12 select-none"
        />
      )}
      <div className="relative z-10 flex items-center gap-1.5 w-full pr-1">
        {/* [-] is FAR LEFT for one-tap release. */}
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
        <Avatar className="h-8 w-8 shrink-0 rounded-full">
          {player.photo && <AvatarImage src={player.photo} />}
          <AvatarFallback className="text-[8px]">{player.name.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <Badge
          variant={player.fc_bc === "FC" ? "destructive" : "default"}
          className="text-[7px] px-1 py-0 rounded-md shrink-0"
        >
          {player.fc_bc}
        </Badge>
        <span className="text-xs font-medium truncate flex-1 min-w-0">{player.name}</span>
        <HealthStatusIcon health={player.health ?? null} size="xs" className="shrink-0" />
        <span className="text-sm font-bold tabular-nums text-foreground shrink-0">${player.salary}</span>
      </div>
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
  const { league } = useLeague();
  const watermarkLogo = league === "wnba" ? wnbaLogo : nbaLogo;
  // Single continuous list — all FC first (sub-sorted by salary DESC), then all BC (DESC).
  const all = [...starters, ...bench];
  const sorted = all.sort((a, b) => {
    if (a.fc_bc !== b.fc_bc) return a.fc_bc === "FC" ? -1 : 1;
    return b.salary - a.salary;
  });
  const empty = !isLoading && sorted.length === 0;

  return (
    <div className="relative flex flex-col gap-0.5 pr-1">
      <img
        src={watermarkLogo}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 m-auto h-40 w-40 object-contain opacity-[0.05] select-none z-0"
      />
      {isLoading && sorted.length === 0
        ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-md relative z-[1]" />)
        : sorted.map((p) => (
            <div key={p.player_id} className="relative z-[1]"><RosterRow
              key={p.player_id}
              player={p}
              isOut={outZone.includes(p.player_id)}
              onToggleOut={onToggleOut}
              onPlayerClick={onPlayerClick}
            /></div>
          ))}
      {empty && (
        <div className="text-xs text-muted-foreground italic px-2 relative z-[1]">Roster loading…</div>
      )}
    </div>
  );
}
