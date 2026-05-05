import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayers, fetchPlayerDetail } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { getTeamLogo } from "@/lib/nba-teams";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import nbaLogo from "@/assets/nba-logo.svg";

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
          <Badge variant={fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-1 py-0 rounded-lg h-3.5">{fc_bc}</Badge>
        </div>
        <span className="text-xs font-mono">${salary}</span>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setSelectedId(null); setSearch(""); } }}>
      <DialogContent className="max-w-xl rounded-xl max-h-[94vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="relative overflow-hidden border-b border-border/50 px-5 pt-5 pb-4 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
          <img
            src={nbaLogo}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -top-6 -right-6 h-32 w-auto opacity-10 rotate-12 select-none blur-[1px]"
          />
          <DialogTitle className="font-heading uppercase tracking-wider text-base relative z-10">Player Comparison</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto p-4">

        {!selectedId ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Search for a player to compare with <span className="font-bold text-foreground">{playerA.name}</span></p>
            <Input
              placeholder="Search player name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg"
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
                          className="group relative overflow-hidden flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent/50 cursor-pointer"
                          onClick={() => { setSelectedId(p.core.id); setSearch(""); }}
                        >
                          {logo && (
                            <img
                              src={logo}
                              alt=""
                              aria-hidden
                              className="pointer-events-none absolute -top-1 -right-1 h-10 w-10 object-contain opacity-15 group-hover:opacity-30 rotate-12 transition-opacity select-none"
                            />
                          )}
                          {p.core.photo ? (
                            <img src={p.core.photo} alt="" className="w-6 h-6 rounded-full object-cover" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-muted" />
                          )}
                          <span className="text-xs font-medium relative z-10">{p.core.name}</span>
                          <Badge variant={p.core.fc_bc === "FC" ? "destructive" : "default"} className="text-[7px] px-1 py-0 rounded-lg relative z-10">{p.core.fc_bc}</Badge>
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
            <div className="relative space-y-1">
              <img
                src={nbaLogo}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 m-auto h-44 w-auto opacity-[0.05] select-none"
              />
              {stats.map(({ label, a, b }) => {
                const bVal = b ?? 0;
                const aWins = a > bVal;
                const bWins = bVal > a;
                return (
                  <div key={label} className="relative z-[1] grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1 border-b border-border/30">
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

            {/* Ballers.IQ Take */}
            <BallersIQTake playerA={playerA} playerB={playerB} />
          </div>
        ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BallersIQTake({ playerA, playerB }: { playerA: any; playerB: any }) {
  const fpA = playerA.season.fp ?? 0, fpB = playerB.season.fp ?? 0;
  const valA = playerA.computed.value ?? 0, valB = playerB.computed.value ?? 0;
  const dFpA = playerA.computed.delta_fp ?? 0, dFpB = playerB.computed.delta_fp ?? 0;
  const stA = (playerA.season.stl ?? 0) + (playerA.season.blk ?? 0);
  const stB = (playerB.season.stl ?? 0) + (playerB.season.blk ?? 0);

  const prodLeader = fpA >= fpB ? playerA : playerB;
  const prodLag = fpA >= fpB ? playerB : playerA;
  const valLeader = valA >= valB ? playerA : playerB;
  const formLeader = dFpA >= dFpB ? playerA : playerB;
  const stockLeader = stA >= stB ? playerA : playerB;

  const lines = [
    `Production: ${prodLeader.name} leads at ${(prodLeader === playerA ? fpA : fpB).toFixed(1)} FP/G vs ${(prodLag === playerA ? fpA : fpB).toFixed(1)}.`,
    `Efficiency: ${valLeader.name} delivers more FP per dollar (${(valLeader === playerA ? valA : valB).toFixed(2)} value).`,
    `Form & defense: ${formLeader.name} trends up (Δ ${(formLeader === playerA ? dFpA : dFpB).toFixed(1)} FP); ${stockLeader.name} edges defensive stocks at ${(stockLeader === playerA ? stA : stB).toFixed(1)}.`,
  ];
  const conclusion = `Pick ${prodLeader.name} for raw output — but ${valLeader === prodLeader ? formLeader.name : valLeader.name} wins on ${valLeader === prodLeader ? "form/defense" : "value"}.`;

  return (
    <section className="relative rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/[0.06] via-card to-card p-4 shadow-[0_4px_24px_-12px_hsl(45_90%_55%/0.35)] overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
      {/* Emblem watermark — top right, transparent (matches Lineup Advisor) */}
      <BallersIQBrand
        variant="emblem"
        forceTheme="light"
        transparent
        className="pointer-events-none absolute -top-8 -right-8 !h-44 !w-44 object-contain opacity-[0.14] rotate-12 select-none"
      />
      <header className="relative z-[1] flex items-center gap-2 mb-2">
        <BallersIQBrand variant="emblem" forceTheme="light" transparent size="sm" />
        <span className="text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-amber-400/90">Ballers.IQ Take</span>
      </header>
      <ul className="relative z-[1] space-y-1">
        {lines.map((l, i) => (
          <li key={i} className="text-[12px] text-foreground/90 leading-snug pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-amber-400/70">{l}</li>
        ))}
      </ul>
      <p className="relative z-[1] mt-2 text-xs font-semibold text-foreground">{conclusion}</p>
    </section>
  );
}
