import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useGameBoxscoreQuery } from "@/hooks/useGameBoxscoreQuery";
import { useLeagueTeams } from "@/hooks/useLeagueTeams";
import { useLeague } from "@/contexts/LeagueContext";
import PlayerModal from "@/components/PlayerModal";
import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";

export interface GameBoxScoreTableGame {
  game_id: string;
  home_team: string;
  away_team: string;
}

type SortKey = "fp" | "mp" | "ps" | "ast" | "reb" | "blk" | "stl" | "salary" | "value";
type SortDir = "asc" | "desc";

const SORT_COLUMNS: { key: SortKey; label: string; highlight?: boolean }[] = [
  { key: "fp", label: "FP" },
  { key: "salary", label: "$", highlight: true },
  { key: "value", label: "V", highlight: true },
  { key: "mp", label: "MP" },
  { key: "ps", label: "PS" },
  { key: "ast", label: "A" },
  { key: "reb", label: "R" },
  { key: "blk", label: "B" },
  { key: "stl", label: "S" },
];

interface Props {
  game: GameBoxScoreTableGame;
  /** Optional external filter (used by GameDetailModal for header badge sync). */
  filterTeam?: string | null;
  setFilterTeam?: (t: string | null) => void;
  /** Override the scroll body height. Defaults to 50vh. */
  maxBodyHeightClass?: string;
  /** Visual density. `compact` shrinks columns and typography for side-by-side use. */
  density?: "default" | "compact";
  /** When true, the table fills its parent's height and distributes rows evenly (no inner scroll). */
  fillHeight?: boolean;
}

export default function GameBoxScoreTable({
  game,
  filterTeam: externalFilterTeam,
  setFilterTeam: externalSetFilterTeam,
  maxBodyHeightClass = "max-h-[50vh]",
  density = "default",
  fillHeight = false,
}: Props) {
  const { data, isLoading } = useGameBoxscoreQuery(game.game_id);
  const [sortKey, setSortKey] = useState<SortKey>("fp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterFcBc, setFilterFcBc] = useState<string | null>(null);
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);
  const [internalFilterTeam, setInternalFilterTeam] = useState<string | null>(null);
  const filterTeam = externalFilterTeam !== undefined ? externalFilterTeam : internalFilterTeam;
  const setFilterTeam = externalSetFilterTeam ?? setInternalFilterTeam;
  const compact = density === "compact";
  const externallyFiltered = externalFilterTeam !== undefined && externalFilterTeam !== null;
  const visibleTriBadges = externallyFiltered
    ? [externalFilterTeam as string]
    : [game.away_team, game.home_team];
  const visibleSortColumns = compact
    ? SORT_COLUMNS.filter((c) => c.key !== "salary" && c.key !== "value")
    : SORT_COLUMNS;
  const gridCols = compact
    ? "grid-cols-[minmax(0,1fr)_repeat(7,28px)]"
    : "grid-cols-[minmax(0,1fr)_repeat(9,36px)]";
  const numCellCls = compact ? "text-[11px]" : "text-[13px]";

  const { teams: leagueTeams } = useLeagueTeams();
  const { league } = useLeague();
  const logoFor = (tri: string) => leagueTeams.find((t) => t.tricode === tri)?.logo;
  const watermarkLogo = league === "wnba" ? wnbaLogo : nbaLogo;

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8" />
        ))}
      </div>
    );
  }

  const players = data?.players ?? [];
  if (players.length === 0) {
    return <p className="p-3 text-sm text-muted-foreground text-center">No player data available</p>;
  }

  let filtered = [...players];
  if (filterTeam) filtered = filtered.filter((p) => p.team === filterTeam);
  if (filterFcBc) filtered = filtered.filter((p) => p.fc_bc === filterFcBc);

  const withValue = filtered.map((p) => ({ ...p, value: p.fp / ((p as any).salary || 1) }));
  const sorted = withValue.sort((a, b) => {
    const av = (a as any)[sortKey] ?? 0;
    const bv = (b as any)[sortKey] ?? 0;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  return (
    <div className={`relative bg-muted/20 ${fillHeight ? "flex flex-col h-full" : ""}`}>
      <img
        src={watermarkLogo}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 m-auto h-48 w-48 opacity-[0.05] select-none"
      />
      <div className={`relative z-[1] grid ${gridCols} gap-0 ${compact ? "px-1.5 py-1 text-[10px]" : "px-2 py-1.5 text-xs"} font-heading uppercase text-muted-foreground border-b bg-muted/40`}>
        <div className={`pr-2 flex items-center ${compact ? "gap-1.5" : "gap-2"} flex-wrap h-7`}>
          {visibleTriBadges.map((tri) => {
            const tlogo = logoFor(tri);
            if (!tlogo) return null;
            const active = filterTeam === tri;
            return (
              <button
                key={tri}
                type="button"
                onClick={() => setFilterTeam(active ? null : tri)}
                aria-label={`Filter by ${tri}`}
                title={`Filter by ${tri}`}
                className={`shrink-0 transition-all ${active ? "opacity-100 scale-110 drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" : "opacity-50 hover:opacity-100 hover:scale-105"}`}
              >
                <img src={tlogo} alt="" className={`${compact ? "h-5 w-5" : "h-6 w-6"} object-contain`} />
              </button>
            );
          })}
          <span>Player</span>
          {!compact && (<><button
            onClick={() => setFilterFcBc(filterFcBc === "FC" ? null : "FC")}
            className={`inline-flex items-center gap-1 h-6 px-2 rounded-lg border text-[10px] font-bold transition-colors ${filterFcBc === "FC" ? "bg-destructive text-destructive-foreground border-destructive" : "border-border hover:bg-muted"}`}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" />
            FC
          </button>
          <button
            onClick={() => setFilterFcBc(filterFcBc === "BC" ? null : "BC")}
            className={`inline-flex items-center gap-1 h-6 px-2 rounded-lg border text-[10px] font-bold transition-colors ${filterFcBc === "BC" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            BC
          </button></>)}
        </div>
        {visibleSortColumns.map(({ key, label, highlight }) => (
          <button
            key={key}
            onClick={() => handleSort(key)}
            className={`text-right hover:text-foreground transition-colors cursor-pointer ${compact ? "text-[10px]" : "text-xs"} ${
              sortKey === key ? "font-bold text-foreground" : ""
            } ${highlight ? "text-red-500 font-bold" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={`relative z-[1] ${fillHeight ? "flex-1 min-h-0 flex flex-col overflow-hidden" : `${maxBodyHeightClass} overflow-y-auto`}`}>
        {sorted.map((p) => {
          const isFc = p.fc_bc === "FC";
          const teamLogo = logoFor(p.team);
          return (
            <div
              key={p.player_id}
              onClick={() => setOpenPlayerId(p.player_id)}
              className={`grid ${gridCols} gap-0 ${compact ? "px-1.5" : "px-2 py-1"} ${!compact ? "" : (fillHeight ? "" : "py-0.5")} ${numCellCls} items-center border-b border-border/40 last:border-b-0 cursor-pointer hover:bg-accent/30 transition-colors even:bg-muted/10 ${fillHeight ? "flex-1 min-h-0" : ""}`}
            >
              <div className="flex items-center gap-2 pr-2 min-w-0">
                <Avatar className={`${compact ? "h-5 w-5" : "h-6 w-6"} shrink-0 ring-2 ${isFc ? "ring-destructive" : "ring-primary"}`}>
                  {p.photo && <AvatarImage src={p.photo} alt={p.name} />}
                  <AvatarFallback className="text-[9px]">{p.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <span className={`${numCellCls} font-semibold truncate`}>{p.name}</span>
                {teamLogo && !compact && (
                  <img src={teamLogo} alt={p.team} className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} shrink-0 object-contain`} />
                )}
              </div>
              <span className={`text-right font-mono ${numCellCls} font-bold`}>{p.fp}</span>
              {!compact && (
                <>
                  <span className={`text-right font-mono ${numCellCls} text-red-500`}>{(p as any).salary ?? 0}</span>
                  <span className={`text-right font-mono ${numCellCls} text-red-500`}>{p.value.toFixed(1)}</span>
                </>
              )}
              <span className={`text-right font-mono ${numCellCls} text-muted-foreground`}>{p.mp}</span>
              <span className={`text-right font-mono ${numCellCls}`}>{p.ps}</span>
              <span className={`text-right font-mono ${numCellCls}`}>{p.ast}</span>
              <span className={`text-right font-mono ${numCellCls}`}>{p.reb}</span>
              <span className={`text-right font-mono ${numCellCls}`}>{p.blk}</span>
              <span className={`text-right font-mono ${numCellCls}`}>{p.stl}</span>
            </div>
          );
        })}
      </div>

      <PlayerModal
        playerId={openPlayerId}
        open={openPlayerId !== null}
        onOpenChange={(o) => !o && setOpenPlayerId(null)}
      />
    </div>
  );
}