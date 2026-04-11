import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useScheduleWeekGames } from "@/hooks/useScheduleWeekGames";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getTeamLogo } from "@/lib/nba-teams";
import PlayerModal from "@/components/PlayerModal";

interface TopPlayersStripProps {
  gw: number;
  day: number;
}

type TopPlayer = { id: number; name: string; team: string; fc_bc: string; photo: string | null; fp: number; salary: number };

export default function TopPlayersStrip({ gw, day }: TopPlayersStripProps) {
  const { data: weekGames } = useScheduleWeekGames(gw);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [mode, setMode] = useState<"fp" | "value">("fp");

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

  if (!topPlayers || (topPlayers.topFC.length === 0 && topPlayers.topBC.length === 0)) return null;

  const fcList = mode === "fp" ? topPlayers.topFC : topPlayers.topFCVal;
  const bcList = mode === "fp" ? topPlayers.topBC : topPlayers.topBCVal;

  const renderPlayer = (p: TopPlayer) => (
    <div key={p.id} className="flex items-center gap-1 flex-1 min-w-0 px-1 py-0.5">
      <Avatar className="h-6 w-6 shrink-0">
        {p.photo && <AvatarImage src={p.photo} />}
        <AvatarFallback className="text-[7px]">{p.name.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <button
          onClick={() => setSelectedPlayerId(p.id)}
          className="text-[9px] font-heading font-bold truncate block max-w-full text-left hover:text-primary hover:underline cursor-pointer"
        >
          {p.name}
        </button>
        <div className="flex items-center gap-0.5">
          {getTeamLogo(p.team) && <img src={getTeamLogo(p.team)} alt="" className="w-2.5 h-2.5" />}
          <span className="text-[8px] text-muted-foreground">{p.team}</span>
          {mode === "fp" ? (
            <span className="text-[9px] font-mono font-bold text-primary">{Number(p.fp).toFixed(1)}</span>
          ) : (
            <span className="text-[9px] font-mono font-bold text-primary">{(p.fp / (p.salary || 1)).toFixed(1)}</span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="bg-card border-x border-b px-1 py-1 flex items-center gap-0">
        {/* Vertical FP/Value toggle */}
        <div className="flex flex-col gap-0.5 mr-1 shrink-0">
          <button
            onClick={() => setMode("fp")}
            className={`text-[7px] font-heading font-bold px-1 py-0.5 rounded-sm border transition-colors ${mode === "fp" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            FP
          </button>
          <button
            onClick={() => setMode("value")}
            className={`text-[7px] font-heading font-bold px-1 py-0.5 rounded-sm border transition-colors ${mode === "value" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            VAL
          </button>
        </div>
        <Badge variant="destructive" className="text-[7px] px-1 py-0 rounded-sm shrink-0 mr-0.5">FC</Badge>
        <div className="flex items-center flex-1 min-w-0">
          {fcList.map(renderPlayer)}
        </div>
        <div className="w-px h-5 bg-border mx-1 shrink-0" />
        <Badge className="text-[7px] px-1 py-0 rounded-sm shrink-0 mr-0.5">BC</Badge>
        <div className="flex items-center flex-1 min-w-0">
          {bcList.map(renderPlayer)}
        </div>
      </div>
      <PlayerModal
        playerId={selectedPlayerId}
        open={selectedPlayerId !== null}
        onOpenChange={(open) => { if (!open) setSelectedPlayerId(null); }}
      />
    </>
  );
}
