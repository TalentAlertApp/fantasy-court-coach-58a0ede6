import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useScheduleWeekGames } from "@/hooks/useScheduleWeekGames";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getTeamLogo } from "@/lib/nba-teams";
import PlayerModal from "@/components/PlayerModal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface TopPlayersStripProps {
  gw: number;
  day: number;
}

type TopPlayer = { id: number; name: string; team: string; fc_bc: string; photo: string | null; fp: number; salary: number };

export function useTopPlayersData(gw: number, day: number) {
  const { data: weekGames } = useScheduleWeekGames(gw);

  const finalGameIds = useMemo(() => {
    if (!weekGames) return [];
    return weekGames
      .filter((g) => g.day === day && (g.status ?? "").toUpperCase().includes("FINAL"))
      .map((g) => g.game_id);
  }, [weekGames, day]);

  const { data: topPlayers } = useQuery({
    queryKey: ["top-players-day", gw, day, finalGameIds],
    queryFn: async () => {
      if (finalGameIds.length === 0) return { topFC: [], topBC: [], topFCVal: [], topBCVal: [] };

      const { data: logs, error } = await supabase
        .from("player_game_logs")
        .select("player_id, fp, game_id")
        .in("game_id", finalGameIds)
        .gt("fp", 0)
        .order("fp", { ascending: false })
        .limit(200);

      if (error) throw error;
      if (!logs || logs.length === 0) return { topFC: [], topBC: [], topFCVal: [], topBCVal: [] };

      const playerIds = [...new Set(logs.map((l) => l.player_id))];

      const { data: players, error: pErr } = await supabase
        .from("players")
        .select("id, name, team, fc_bc, photo, salary")
        .in("id", playerIds);

      if (pErr) throw pErr;

      const playerMap = new Map(players?.map((p) => [p.id, p]) ?? []);

      const bestByPlayer = new Map<number, { fp: number; player_id: number }>();
      for (const l of logs) {
        const existing = bestByPlayer.get(l.player_id);
        if (!existing || l.fp > existing.fp) {
          bestByPlayer.set(l.player_id, { fp: l.fp, player_id: l.player_id });
        }
      }

      const enriched = [...bestByPlayer.values()]
        .map((entry) => {
          const p = playerMap.get(entry.player_id);
          if (!p) return null;
          return { ...p, fp: entry.fp, salary: Number(p.salary) || 1 } as TopPlayer;
        })
        .filter(Boolean) as TopPlayer[];

      const topFC = enriched.filter((p) => p.fc_bc === "FC").sort((a, b) => b.fp - a.fp).slice(0, 5);
      const topBC = enriched.filter((p) => p.fc_bc === "BC").sort((a, b) => b.fp - a.fp).slice(0, 5);
      const topFCVal = enriched.filter((p) => p.fc_bc === "FC").sort((a, b) => (b.fp / (b.salary || 1)) - (a.fp / (a.salary || 1))).slice(0, 5);
      const topBCVal = enriched.filter((p) => p.fc_bc === "BC").sort((a, b) => (b.fp / (b.salary || 1)) - (a.fp / (a.salary || 1))).slice(0, 5);

      return { topFC, topBC, topFCVal, topBCVal };
    },
    enabled: finalGameIds.length > 0,
    staleTime: 300_000,
  });

  const hasData = !!(topPlayers && (topPlayers.topFC.length > 0 || topPlayers.topBC.length > 0));
  return { topPlayers, hasData };
}

export function TopPlayersPanel({ gw, day }: TopPlayersStripProps) {
  const { topPlayers } = useTopPlayersData(gw, day);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  if (!topPlayers || (topPlayers.topFC.length === 0 && topPlayers.topBC.length === 0)) {
    return <p className="text-sm text-muted-foreground text-center py-6">No completed games for this day yet.</p>;
  }

  const renderPlayer = (p: TopPlayer, mode: "fp" | "value") => (
    <div
      key={p.id}
      className="group relative overflow-hidden flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => setSelectedPlayerId(p.id)}
    >
      {(p.photo || getTeamLogo(p.team)) && (
        <img
          src={p.photo || getTeamLogo(p.team)!}
          aria-hidden
          className="pointer-events-none absolute inset-0 m-auto h-14 w-14 object-contain opacity-30 transition-all duration-300 group-hover:scale-125 group-hover:opacity-60"
        />
      )}
      <Badge variant={p.fc_bc === "FC" ? "destructive" : "default"} className="relative z-10 text-[8px] px-1 py-0 rounded-lg shrink-0">{p.fc_bc}</Badge>
      <Avatar className="relative z-10 h-8 w-8 shrink-0">
        {getTeamLogo(p.team) && <AvatarImage src={getTeamLogo(p.team)!} className="object-contain p-0.5" />}
        <AvatarFallback className="text-[9px]">{p.team.slice(0, 3).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="relative z-10 flex-1 min-w-0">
        <span className="text-sm font-heading font-bold truncate block">{p.name}</span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground transition-colors group-hover:text-[hsl(var(--nba-yellow))] group-hover:font-semibold">{p.team}</span>
          <span className="text-[10px] text-muted-foreground transition-colors group-hover:text-[hsl(var(--nba-yellow))] group-hover:font-semibold">·</span>
          <span className="text-[10px] font-mono text-muted-foreground transition-colors group-hover:text-[hsl(var(--nba-yellow))] group-hover:font-semibold">${p.salary}</span>
        </div>
      </div>
      {mode === "fp" ? (
        <span className="relative z-10 text-sm font-mono font-bold text-primary">{Number(p.fp).toFixed(1)}</span>
      ) : (
        <span className="relative z-10 text-sm font-mono font-bold text-primary">{(p.fp / (p.salary || 1)).toFixed(1)}</span>
      )}
    </div>
  );

  const renderSection = (label: string, players: TopPlayer[], mode: "fp" | "value", variant: "destructive" | "default") => (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-1 px-3">
        <Badge variant={variant} className="text-[8px] px-1.5 py-0 rounded-lg">{label}</Badge>
        <span className="text-[10px] text-muted-foreground font-heading">Top 5</span>
      </div>
      <div className="space-y-0.5">
        {players.map((p) => renderPlayer(p, mode))}
      </div>
    </div>
  );

  return (
    <>
      <Tabs defaultValue="fp" className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-8 rounded-t-xl rounded-b-none">
          <TabsTrigger value="fp" className="text-xs font-heading font-bold rounded-xl">Fantasy Points</TabsTrigger>
          <TabsTrigger value="value" className="text-xs font-heading font-bold rounded-xl">Value (FP/$)</TabsTrigger>
        </TabsList>
        <TabsContent value="fp" className="mt-0 pt-2">
          <div className="flex gap-2">
            {renderSection("FC", topPlayers.topFC, "fp", "destructive")}
            <div className="w-px bg-border shrink-0" />
            {renderSection("BC", topPlayers.topBC, "fp", "default")}
          </div>
        </TabsContent>
        <TabsContent value="value" className="mt-0 pt-2">
          <div className="flex gap-2">
            {renderSection("FC", topPlayers.topFCVal, "value", "destructive")}
            <div className="w-px bg-border shrink-0" />
            {renderSection("BC", topPlayers.topBCVal, "value", "default")}
          </div>
        </TabsContent>
      </Tabs>
      <PlayerModal
        playerId={selectedPlayerId}
        open={selectedPlayerId !== null}
        onOpenChange={(open) => { if (!open) setSelectedPlayerId(null); }}
      />
    </>
  );
}

export default function TopPlayersStrip({ gw, day }: TopPlayersStripProps) {
  return <TopPlayersPanel gw={gw} day={day} />;
}
