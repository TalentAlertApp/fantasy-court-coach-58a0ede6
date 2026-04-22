import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tv2, Table2, BarChart3, Mic, ExternalLink } from "lucide-react";
import { useGameBoxscoreQuery } from "@/hooks/useGameBoxscoreQuery";
import { getTeamLogo } from "@/lib/nba-teams";
import PlayerModal from "@/components/PlayerModal";

export interface GameDetailGame {
  game_id: string;
  home_team: string;
  away_team: string;
  home_pts: number;
  away_pts: number;
  status?: string | null;
  game_boxscore_url?: string | null;
  game_charts_url?: string | null;
  game_playbyplay_url?: string | null;
  game_recap_url?: string | null;
  nba_game_url?: string | null;
  played?: boolean;
}

function isPlayed(g: GameDetailGame): boolean {
  if (typeof g.played === "boolean") return g.played;
  if (g.status) return g.status.toUpperCase().includes("FINAL");
  return (g.home_pts ?? 0) > 0 || (g.away_pts ?? 0) > 0;
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

function GameBoxScoreTable({ game }: { game: GameDetailGame }) {
  const { data, isLoading } = useGameBoxscoreQuery(game.game_id);
  const [sortKey, setSortKey] = useState<SortKey>("fp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterTeam, setFilterTeam] = useState<string | null>(null);
  const [filterFcBc, setFilterFcBc] = useState<string | null>(null);
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);

  const awayLogo = getTeamLogo(game.away_team);
  const homeLogo = getTeamLogo(game.home_team);

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
    <div className="border-t bg-muted/20">
      <div
        className="grid grid-cols-[minmax(0,1fr)_repeat(9,32px)] gap-0 px-3 py-2 text-[10px] font-heading uppercase text-muted-foreground border-b bg-muted/40"
      >
        <div className="pr-2 flex items-center gap-1 flex-wrap">
          <span>Player</span>
          <button
            onClick={() => setFilterTeam(filterTeam === game.away_team ? null : game.away_team)}
            className={`flex items-center gap-0.5 px-1 py-0.5 rounded-lg border text-[8px] font-bold transition-colors ${filterTeam === game.away_team ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            {awayLogo && <img src={awayLogo} alt="" className="w-3 h-3" />}
            {game.away_team}
          </button>
          <button
            onClick={() => setFilterTeam(filterTeam === game.home_team ? null : game.home_team)}
            className={`flex items-center gap-0.5 px-1 py-0.5 rounded-lg border text-[8px] font-bold transition-colors ${filterTeam === game.home_team ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            {homeLogo && <img src={homeLogo} alt="" className="w-3 h-3" />}
            {game.home_team}
          </button>
          <button
            onClick={() => setFilterFcBc(filterFcBc === "FC" ? null : "FC")}
            className={`px-1.5 py-0.5 rounded-lg border text-[8px] font-bold transition-colors ${filterFcBc === "FC" ? "bg-destructive text-destructive-foreground border-destructive" : "border-border hover:bg-muted"}`}
          >
            FC
          </button>
          <button
            onClick={() => setFilterFcBc(filterFcBc === "BC" ? null : "BC")}
            className={`px-1.5 py-0.5 rounded-lg border text-[8px] font-bold transition-colors ${filterFcBc === "BC" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
          >
            BC
          </button>
        </div>
        {SORT_COLUMNS.map(({ key, label, highlight }) => (
          <button
            key={key}
            onClick={() => handleSort(key)}
            className={`text-right hover:text-foreground transition-colors cursor-pointer text-[10px] ${
              sortKey === key ? "font-bold text-foreground" : ""
            } ${highlight ? "text-red-500 font-bold" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="max-h-[50vh] overflow-y-auto">
        {sorted.map((p) => {
          const isFc = p.fc_bc === "FC";
          return (
            <div
              key={p.player_id}
              onClick={() => setOpenPlayerId(p.player_id)}
              className="grid grid-cols-[minmax(0,1fr)_repeat(9,32px)] gap-0 px-3 py-1.5 text-xs items-center border-b border-border/40 last:border-b-0 cursor-pointer hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-1.5 pr-2 min-w-0">
                <Avatar className="h-5 w-5 shrink-0">
                  {p.photo && <AvatarImage src={p.photo} alt={p.name} />}
                  <AvatarFallback className="text-[8px]">{p.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <Badge
                  variant={isFc ? "destructive" : "default"}
                  className="text-[7px] px-0.5 py-0 shrink-0 rounded-lg font-heading min-w-[18px] justify-center"
                >
                  {p.fc_bc}
                </Badge>
                <span className="text-xs font-medium truncate">{p.name}</span>
              </div>
              <span className="text-right font-mono text-xs font-bold">{p.fp}</span>
              <span className="text-right font-mono text-xs text-red-500">{(p as any).salary ?? 0}</span>
              <span className="text-right font-mono text-xs text-red-500">{p.value.toFixed(1)}</span>
              <span className="text-right font-mono text-xs text-muted-foreground">{p.mp}</span>
              <span className="text-right font-mono text-xs">{p.ps}</span>
              <span className="text-right font-mono text-xs">{p.ast}</span>
              <span className="text-right font-mono text-xs">{p.reb}</span>
              <span className="text-right font-mono text-xs">{p.blk}</span>
              <span className="text-right font-mono text-xs">{p.stl}</span>
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

interface GameDetailModalProps {
  game: GameDetailGame | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GameDetailModal({ game, open, onOpenChange }: GameDetailModalProps) {
  if (!game) return null;
  const awayLogo = getTeamLogo(game.away_team);
  const homeLogo = getTeamLogo(game.home_team);
  const played = isPlayed(game);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${played ? "max-w-2xl" : "max-w-sm"} rounded-xl p-0 overflow-hidden`}>
        <div className="p-4">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm uppercase">Game Detail</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center gap-3 py-2">
            <div className="flex items-center gap-1.5 text-right">
              {awayLogo && <img src={awayLogo} alt="" className="w-6 h-6" />}
              <span className="font-heading font-bold text-sm">{game.away_team}</span>
            </div>
            <div className="text-center">
              <span className="font-mono font-black text-lg">{game.away_pts} - {game.home_pts}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-bold text-sm">{game.home_team}</span>
              {homeLogo && <img src={homeLogo} alt="" className="w-6 h-6" />}
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 py-1 flex-wrap">
            {game.game_boxscore_url && (
              <a href={game.game_boxscore_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-xl border">
                <Table2 className="h-3.5 w-3.5" /> BoxScore
              </a>
            )}
            {game.game_charts_url && (
              <a href={game.game_charts_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-xl border">
                <BarChart3 className="h-3.5 w-3.5" /> Charts
              </a>
            )}
            {game.game_playbyplay_url && (
              <a href={game.game_playbyplay_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-xl border">
                <Mic className="h-3.5 w-3.5" /> PbP
              </a>
            )}
            {game.nba_game_url && (
              <a href={game.nba_game_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-xl border">
                <ExternalLink className="h-3.5 w-3.5" /> NBA
              </a>
            )}
          </div>
          {game.game_recap_url && (
            <div className="flex justify-center pt-1">
              <a
                href={game.game_recap_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-green-500 hover:text-green-400 transition-colors px-3 py-1.5 rounded-xl border border-green-500/40"
              >
                <Tv2 className="h-3.5 w-3.5" /> Watch Recap on NBA.com <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
        {played && <GameBoxScoreTable game={game} />}
      </DialogContent>
    </Dialog>
  );
}