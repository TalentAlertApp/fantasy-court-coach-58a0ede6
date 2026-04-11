import { useMemo } from "react";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { useScheduleWeekGames } from "@/hooks/useScheduleWeekGames";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getTeamLogo } from "@/lib/nba-teams";

interface TopPlayersStripProps {
  gw: number;
  day: number;
}

export default function TopPlayersStrip({ gw, day }: TopPlayersStripProps) {
  const { data: weekGames } = useScheduleWeekGames(gw);
  const { data: playersData } = usePlayersQuery({ sort: "fp5", order: "desc", limit: 500 });

  const { topFC, topBC } = useMemo(() => {
    if (!weekGames || !playersData?.items) return { topFC: [], topBC: [] };

    // Get teams playing on this day
    const teamsPlaying = new Set<string>();
    for (const g of weekGames) {
      if (g.day === day) {
        teamsPlaying.add(g.home_team);
        teamsPlaying.add(g.away_team);
      }
    }

    const playing = playersData.items.filter((p) => teamsPlaying.has(p.core.team));
    const getFp = (p: any) => p.season.fp_pg5 ?? p.season.fp_pg_t ?? 0;
    const fc = playing.filter((p) => p.core.fc_bc === "FC").sort((a, b) => getFp(b) - getFp(a)).slice(0, 5);
    const bc = playing.filter((p) => p.core.fc_bc === "BC").sort((a, b) => getFp(b) - getFp(a)).slice(0, 5);
    return { topFC: fc, topBC: bc, getFp };
  }, [weekGames, playersData, day]);

  const { getFp } = useMemo(() => ({ getFp: (p: any) => p.season.fp_pg5 ?? p.season.fp_pg_t ?? 0 }), []);

  if (topFC.length === 0 && topBC.length === 0) return null;

  const renderPlayer = (p: typeof topFC[0]) => (
    <div key={p.core.id} className="flex items-center gap-1.5 min-w-[140px] px-2 py-1">
      <Avatar className="h-7 w-7 shrink-0">
        {p.core.photo && <AvatarImage src={p.core.photo} />}
        <AvatarFallback className="text-[8px]">{p.core.name.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="text-[10px] font-heading font-bold truncate max-w-[90px]">{p.core.name}</div>
        <div className="flex items-center gap-1">
          {getTeamLogo(p.core.team) && <img src={getTeamLogo(p.core.team)} alt="" className="w-3 h-3" />}
          <span className="text-[9px] text-muted-foreground">{p.core.team}</span>
          <span className="text-[9px] font-mono font-bold text-primary">{(p.season.fp_pg5 ?? p.season.fp_pg_t ?? 0).toFixed(1)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-card border-x border-b px-2 py-1.5 flex items-center gap-0 overflow-x-auto scrollbar-hide">
      <Badge variant="destructive" className="text-[8px] px-1 py-0 rounded-sm shrink-0 mr-1">FC</Badge>
      <div className="flex items-center">
        {topFC.map(renderPlayer)}
      </div>
      <div className="w-px h-6 bg-border mx-2 shrink-0" />
      <Badge className="text-[8px] px-1 py-0 rounded-sm shrink-0 mr-1">BC</Badge>
      <div className="flex items-center">
        {topBC.map(renderPlayer)}
      </div>
    </div>
  );
}
