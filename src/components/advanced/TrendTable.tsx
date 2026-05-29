import { TrendingUp, TrendingDown } from "lucide-react";
import { getTeamLogo } from "@/lib/nba-teams";
import type { TrendRow } from "@/hooks/usePlayingTimeTrends";
import { Badge } from "@/components/ui/badge";
import SectionHeader from "./SectionHeader";

export type TrendTableRow = TrendRow & { fc_bc?: "FC" | "BC" | null };

interface Props {
  rows: TrendTableRow[];
  type: "increase" | "decrease";
  onPlayerClick: (id: number) => void;
  onTeamClick: (tricode: string) => void;
}

export default function TrendTable({ rows, type, onPlayerClick, onTeamClick }: Props) {
  const isIncrease = type === "increase";
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card/40 backdrop-blur-sm">
      <SectionHeader
        tone={isIncrease ? "green" : "red"}
        icon={isIncrease ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        title={isIncrease ? "Increased Playing Time" : "Decreased Playing Time"}
        meta="Last 7 Game Days"
      />
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
                {r.fc_bc && (
                  <Badge
                    variant={r.fc_bc === "FC" ? "destructive" : "default"}
                    className="text-[8px] px-1 py-0 rounded font-heading shrink-0 min-w-[20px] justify-center"
                  >
                    {r.fc_bc}
                  </Badge>
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