import { useState } from "react";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";
import { usePlayingTimeTrends, TrendRow } from "@/hooks/usePlayingTimeTrends";
import { getTeamLogo } from "@/lib/nba-teams";
import { Skeleton } from "@/components/ui/skeleton";
import PlayerModal from "@/components/PlayerModal";
import TeamModal from "@/components/TeamModal";

function TrendTable({ rows, type, onPlayerClick, onTeamClick }: {
  rows: TrendRow[];
  type: "increase" | "decrease";
  onPlayerClick: (id: number) => void;
  onTeamClick: (tricode: string) => void;
}) {
  const isIncrease = type === "increase";
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className={`flex items-center gap-2 px-4 py-2.5 ${isIncrease ? "bg-emerald-500/10 border-b border-emerald-500/20" : "bg-destructive/10 border-b border-destructive/20"}`}>
        {isIncrease ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
        <span className="text-xs font-heading font-bold uppercase tracking-wider">
          {isIncrease ? "Increased Playing Time" : "Decreased Playing Time"}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">Last 7 Days</span>
      </div>
      <div className="grid grid-cols-[1fr_40px_60px_60px_65px] gap-0 px-3 py-1.5 text-[10px] font-heading uppercase text-muted-foreground border-b bg-muted/40">
        <span>Player</span>
        <span className="text-center">GP</span>
        <span className="text-right">Season</span>
        <span className="text-right">7 Days</span>
        <span className="text-right">{isIncrease ? "Increase" : "Decrease"}</span>
      </div>
      <div className="max-h-[480px] overflow-y-auto">
        {rows.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No data available</div>
        )}
        {rows.map((r, i) => {
          const logo = getTeamLogo(r.team);
          return (
            <div key={r.id} className={`grid grid-cols-[1fr_40px_60px_60px_65px] gap-0 px-3 py-1.5 items-center text-xs border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer ${i % 2 === 0 ? "bg-card" : "bg-muted/20"}`}>
              <div className="flex items-center gap-2 min-w-0">
                {r.photo ? (
                  <img src={r.photo} alt="" className="w-6 h-6 rounded-full object-cover bg-muted shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-muted shrink-0" />
                )}
                <span
                  className="truncate font-medium hover:text-primary hover:underline"
                  onClick={() => onPlayerClick(r.id)}
                >
                  {r.name}
                </span>
                {logo && (
                  <img
                    src={logo}
                    alt={r.team}
                    className="w-4 h-4 shrink-0 cursor-pointer hover:scale-125 transition-transform"
                    onClick={(e) => { e.stopPropagation(); onTeamClick(r.team); }}
                  />
                )}
              </div>
              <span className="text-center text-muted-foreground">{r.gp7d}</span>
              <span className="text-right text-muted-foreground">{r.seasonAvg.toFixed(1)}</span>
              <span className="text-right font-medium">{r.avg7d.toFixed(1)}</span>
              <span className={`text-right font-bold ${isIncrease ? "text-emerald-500" : "text-destructive"}`}>
                {isIncrease ? "+" : ""}{r.delta.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdvancedPage() {
  const { data, isLoading } = usePlayingTimeTrends();
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-heading font-bold uppercase tracking-wider">Playing Time Trends</h1>
        </div>
        {data?.updatedAt && (
          <span className="text-[10px] text-muted-foreground font-body">
            Updated {new Date(data.updatedAt).toLocaleString()}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 gap-4">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <TrendTable rows={data?.increased ?? []} type="increase" onPlayerClick={setSelectedPlayerId} onTeamClick={setSelectedTeam} />
          <TrendTable rows={data?.decreased ?? []} type="decrease" onPlayerClick={setSelectedPlayerId} onTeamClick={setSelectedTeam} />
        </div>
      )}

      <PlayerModal playerId={selectedPlayerId} open={selectedPlayerId !== null} onOpenChange={(open) => !open && setSelectedPlayerId(null)} />
      <TeamModal tricode={selectedTeam ?? ""} open={selectedTeam !== null} onOpenChange={(open) => !open && setSelectedTeam(null)} />
    </div>
  );
}
