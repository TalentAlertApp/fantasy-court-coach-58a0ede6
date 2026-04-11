import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayers, fetchPlayerDetail } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { getTeamLogo } from "@/lib/nba-teams";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PlayerCompareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerA: {
    id: number;
    name: string;
    team: string;
    photo: string | null;
    fc_bc: string;
    salary: number;
    season: { fp: number; mpg?: number; pts: number; reb: number; ast: number; stl: number; blk: number };
    computed: { value: number; stocks5: number; delta_fp: number };
  };
}

export default function PlayerCompareModal({ open, onOpenChange, playerA }: PlayerCompareModalProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: searchResults } = useQuery({
    queryKey: ["compare-search", search],
    queryFn: () => fetchPlayers({ search, limit: 10 }),
    enabled: search.length >= 2,
  });

  const { data: playerBData, isLoading: bLoading } = useQuery({
    queryKey: ["player-detail", selectedId],
    queryFn: () => fetchPlayerDetail(selectedId!),
    enabled: selectedId !== null,
  });

  const playerB = playerBData
    ? {
        id: playerBData.player.core.id,
        name: playerBData.player.core.name,
        team: playerBData.player.core.team,
        photo: playerBData.player.core.photo,
        fc_bc: playerBData.player.core.fc_bc,
        salary: playerBData.player.core.salary,
        season: playerBData.player.season,
        computed: playerBData.player.computed,
      }
    : null;

  const stats = [
    { label: "FP/G", a: playerA.season.fp, b: playerB?.season.fp },
    { label: "MPG", a: playerA.season.mpg ?? 0, b: playerB?.season.mpg ?? 0 },
    { label: "PTS", a: playerA.season.pts, b: playerB?.season.pts },
    { label: "REB", a: playerA.season.reb, b: playerB?.season.reb },
    { label: "AST", a: playerA.season.ast, b: playerB?.season.ast },
    { label: "STL", a: playerA.season.stl, b: playerB?.season.stl },
    { label: "BLK", a: playerA.season.blk, b: playerB?.season.blk },
    { label: "Value", a: playerA.computed.value, b: playerB?.computed.value },
    { label: "Salary", a: playerA.salary, b: playerB?.salary },
    { label: "Δ FP", a: playerA.computed.delta_fp, b: playerB?.computed.delta_fp },
  ];

  function PlayerHeader({ name, team, photo, fc_bc, salary }: { name: string; team: string; photo: string | null; fc_bc: string; salary: number }) {
    const logo = getTeamLogo(team);
    return (
      <div className="flex flex-col items-center gap-1.5">
        {photo ? (
          <img src={photo} alt={name} className="w-14 h-14 rounded-full object-cover bg-muted" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-heading font-bold text-muted-foreground">
            {name.substring(0, 2).toUpperCase()}
          </div>
        )}
        <p className="text-xs font-heading font-bold uppercase text-center leading-tight">{name}</p>
        <div className="flex items-center gap-1">
          {logo && <img src={logo} alt={team} className="w-4 h-4" />}
          <span className="text-[10px] text-muted-foreground">{team}</span>
          <Badge variant={fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-1 py-0 rounded-sm h-3.5">{fc_bc}</Badge>
        </div>
        <span className="text-xs font-mono">${salary}</span>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setSelectedId(null); setSearch(""); } }}>
      <DialogContent className="max-w-lg rounded-sm max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wider text-sm">Player Comparison</DialogTitle>
        </DialogHeader>

        {!selectedId ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Search for a player to compare with <span className="font-bold text-foreground">{playerA.name}</span></p>
            <Input
              placeholder="Search player name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-sm"
            />
            {searchResults && search.length >= 2 && (
              <ScrollArea className="max-h-60">
                <div className="space-y-1">
                  {searchResults.items
                    .filter((p: any) => p.core.id !== playerA.id)
                    .map((p: any) => {
                      const logo = getTeamLogo(p.core.team);
                      return (
                        <div
                          key={p.core.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent/50 cursor-pointer"
                          onClick={() => { setSelectedId(p.core.id); setSearch(""); }}
                        >
                          {p.core.photo ? (
                            <img src={p.core.photo} alt="" className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-muted" />
                          )}
                          {logo && <img src={logo} alt="" className="w-4 h-4" />}
                          <span className="text-xs font-medium">{p.core.name}</span>
                          <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-1 py-0 rounded-sm">{p.core.fc_bc}</Badge>
                        </div>
                      );
                    })}
                </div>
              </ScrollArea>
            )}
          </div>
        ) : bLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : playerB ? (
          <div className="space-y-4">
            {/* Player headers side by side */}
            <div className="grid grid-cols-2 gap-4">
              <PlayerHeader name={playerA.name} team={playerA.team} photo={playerA.photo} fc_bc={playerA.fc_bc} salary={playerA.salary} />
              <PlayerHeader name={playerB.name} team={playerB.team} photo={playerB.photo} fc_bc={playerB.fc_bc} salary={playerB.salary} />
            </div>

            {/* Stat rows */}
            <div className="space-y-1">
              {stats.map(({ label, a, b }) => {
                const bVal = b ?? 0;
                const aWins = a > bVal;
                const bWins = bVal > a;
                return (
                  <div key={label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1 border-b border-border/30">
                    <span className={`text-xs font-mono text-right ${aWins ? "font-bold text-emerald-400" : ""}`}>
                      {typeof a === "number" ? (Number.isInteger(a) ? a : a.toFixed(1)) : a}
                    </span>
                    <span className="text-[10px] font-heading font-bold uppercase text-muted-foreground w-12 text-center">{label}</span>
                    <span className={`text-xs font-mono ${bWins ? "font-bold text-emerald-400" : ""}`}>
                      {typeof bVal === "number" ? (Number.isInteger(bVal) ? bVal : bVal.toFixed(1)) : bVal}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => { setSelectedId(null); setSearch(""); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Compare with another player
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
