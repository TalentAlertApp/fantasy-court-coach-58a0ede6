import { z } from "zod";
import { ScheduleGameSchema } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { getTeamLogo } from "@/lib/nba-teams";

type ScheduleGame = z.infer<typeof ScheduleGameSchema>;

interface ScheduleListProps {
  games: ScheduleGame[];
}

export default function ScheduleList({ games }: ScheduleListProps) {
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
      {games.map((g, i) => (
        <div key={g.game_id} className={`bg-card flex items-center justify-between px-4 py-3 ${i < games.length - 1 ? "border-b" : ""}`}>
          <div className="flex items-center gap-4 flex-1">
            <div className="flex items-center gap-2 text-right min-w-[90px] justify-end">
              {getTeamLogo(g.away_team) && <img src={getTeamLogo(g.away_team)} alt={g.away_team} className="w-5 h-5" />}
              <div>
                <p className="font-heading font-bold text-sm uppercase">{g.away_team}</p>
                {g.status === "FINAL" && <p className="text-lg font-mono font-bold">{g.away_pts}</p>}
              </div>
            </div>
            <span className="text-muted-foreground text-xs font-heading">@</span>
            <div className="flex items-center gap-2 min-w-[90px]">
              {getTeamLogo(g.home_team) && <img src={getTeamLogo(g.home_team)} alt={g.home_team} className="w-5 h-5" />}
              <div>
                <p className="font-heading font-bold text-sm uppercase">{g.home_team}</p>
                {g.status === "FINAL" && <p className="text-lg font-mono font-bold">{g.home_pts}</p>}
              </div>
            </div>
          </div>
          <div className="text-right flex items-center gap-2">
            <Badge variant={g.status === "FINAL" ? "secondary" : "outline"} className="text-[10px] rounded-sm font-heading">
              {g.status}
            </Badge>
            {g.tipoff_utc && (
              <span className="text-xs font-mono border border-border px-1.5 py-0.5 rounded-sm">
                {new Date(g.tipoff_utc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
