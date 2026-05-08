import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tv2, Table2, BarChart3, Mic, ExternalLink, Trophy, History } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useGameBoxscoreQuery } from "@/hooks/useGameBoxscoreQuery";
import { useLeagueTeams } from "@/hooks/useLeagueTeams";
import { useLeague } from "@/contexts/LeagueContext";
import { useStandingsContext } from "@/hooks/useStandingsContext";
import { useIsPreseason } from "@/hooks/useIsPreseason";
import { getVenue } from "@/lib/nba-venues";
import PlayerModal from "@/components/PlayerModal";
import { formatTipoffLabel } from "@/hooks/useUpcomingByTeam";
import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";

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
  gw?: number | null;
  day?: number | null;
  tipoff_utc?: string | null;
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

function GameBoxScoreTable({
  game,
  filterTeam,
  setFilterTeam,
}: {
  game: GameDetailGame;
  filterTeam: string | null;
  setFilterTeam: (t: string | null) => void;
}) {
  const { data, isLoading } = useGameBoxscoreQuery(game.game_id);
  const [sortKey, setSortKey] = useState<SortKey>("fp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterFcBc, setFilterFcBc] = useState<string | null>(null);
  const [openPlayerId, setOpenPlayerId] = useState<number | null>(null);
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
    <div className="relative border-t bg-muted/20">
      <img
        src={watermarkLogo}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 m-auto h-48 w-48 opacity-[0.05] select-none"
      />
      <div
        className="relative z-[1] grid grid-cols-[minmax(0,1fr)_repeat(9,36px)] gap-0 px-2 py-1.5 text-xs font-heading uppercase text-muted-foreground border-b bg-muted/40"
      >
        <div className="pr-2 flex items-center gap-2 flex-wrap h-7">
          {/* Team badge filters */}
          {[game.away_team, game.home_team].map((tri) => {
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
                <img src={tlogo} alt="" className="h-6 w-6 object-contain" />
              </button>
            );
          })}
          <span>Player</span>
          <button
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
          </button>
        </div>
        {SORT_COLUMNS.map(({ key, label, highlight }) => (
          <button
            key={key}
            onClick={() => handleSort(key)}
            className={`text-right hover:text-foreground transition-colors cursor-pointer text-xs ${
              sortKey === key ? "font-bold text-foreground" : ""
            } ${highlight ? "text-red-500 font-bold" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="relative z-[1] max-h-[50vh] overflow-y-auto">
        {sorted.map((p) => {
          const isFc = p.fc_bc === "FC";
          const teamLogo = logoFor(p.team);
          return (
            <div
              key={p.player_id}
              onClick={() => setOpenPlayerId(p.player_id)}
              className="grid grid-cols-[minmax(0,1fr)_repeat(9,36px)] gap-0 px-2 py-1 text-[13px] items-center border-b border-border/40 last:border-b-0 cursor-pointer hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-2 pr-2 min-w-0">
                <Avatar
                  className={`h-6 w-6 shrink-0 ring-2 ${isFc ? "ring-destructive" : "ring-primary"}`}
                >
                  {p.photo && <AvatarImage src={p.photo} alt={p.name} />}
                  <AvatarFallback className="text-[9px]">{p.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <span className="text-[13px] font-semibold truncate">{p.name}</span>
                {teamLogo && (
                  <img src={teamLogo} alt={p.team} className="h-4 w-4 shrink-0 object-contain" />
                )}
              </div>
              <span className="text-right font-mono text-[13px] font-bold">{p.fp}</span>
              <span className="text-right font-mono text-[13px] text-red-500">{(p as any).salary ?? 0}</span>
              <span className="text-right font-mono text-[13px] text-red-500">{p.value.toFixed(1)}</span>
              <span className="text-right font-mono text-[13px] text-muted-foreground">{p.mp}</span>
              <span className="text-right font-mono text-[13px]">{p.ps}</span>
              <span className="text-right font-mono text-[13px]">{p.ast}</span>
              <span className="text-right font-mono text-[13px]">{p.reb}</span>
              <span className="text-right font-mono text-[13px]">{p.blk}</span>
              <span className="text-right font-mono text-[13px]">{p.stl}</span>
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
  return <GameDetailModalInner game={game} open={open} onOpenChange={onOpenChange} />;
}

function GameDetailModalInner({ game, open, onOpenChange }: { game: GameDetailGame; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { teams: leagueTeams } = useLeagueTeams();
  const { league } = useLeague();
  const logoFor = (tri: string) => leagueTeams.find((t) => t.tricode === tri)?.logo;
  const awayLogo = logoFor(game.away_team);
  const homeLogo = logoFor(game.home_team);
  const played = isPlayed(game);
  const venue = getVenue(game.home_team);
  const leagueName = league === "wnba" ? "WNBA" : "NBA";
  const recapHost = league === "wnba" ? "WNBA.com" : "NBA.com";
  const tipoffLabel = game.tipoff_utc ? formatTipoffLabel(game.tipoff_utc) : null;
  const hasGwDay = game.gw != null && game.day != null;
  const [filterTeam, setFilterTeam] = useState<string | null>(null);
  const toggleFilter = (tri: string) => setFilterTeam((prev) => (prev === tri ? null : tri));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${played ? "max-w-3xl" : "max-w-xl"} rounded-xl p-0 overflow-hidden`}>
        <div className="relative px-4 pt-2 pb-1.5 overflow-hidden bg-gradient-to-br from-primary/10 via-card to-card border-b border-border/40">
          {venue?.image && (
            <img
              src={venue.image}
              alt=""
              aria-hidden
              loading="lazy"
              className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-[0.18] dark:opacity-[0.28] select-none"
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-card/60 via-card/30 to-card/60" />
          <DialogHeader>
            <DialogTitle className="sr-only">Game Detail</DialogTitle>
          </DialogHeader>
          {(hasGwDay || tipoffLabel) && (
            <div className="relative flex items-center justify-center gap-2">
              {hasGwDay && (
                <span className="inline-flex items-center gap-1 px-2 py-px rounded-md border border-border/60 bg-background/40 backdrop-blur-sm text-[10px] font-heading uppercase tracking-[0.18em] font-bold text-foreground/90">
                  GW {game.gw} · D {game.day}
                </span>
              )}
              {tipoffLabel && (
                <span className="inline-flex items-center px-2 py-px rounded-md border border-border/60 bg-background/40 backdrop-blur-sm text-[10px] font-mono tabular-nums text-foreground/80">
                  {tipoffLabel}
                </span>
              )}
            </div>
          )}
          <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-2">
            {/* Away — name on right of watermark */}
            <div className="relative h-20 flex items-center justify-end pr-2 overflow-hidden">
              {awayLogo && (
                played ? (
                  <button
                    type="button"
                    onClick={() => toggleFilter(game.away_team)}
                    aria-label={`Filter by ${game.away_team}`}
                    className={`pointer-events-auto absolute left-0 top-1/2 -translate-y-1/2 h-24 w-24 -rotate-12 transition-all duration-200 hover:scale-110 ${filterTeam === game.away_team ? "opacity-100 scale-110 drop-shadow-[0_0_18px_hsl(var(--primary)/0.55)]" : "opacity-40 hover:opacity-95"}`}
                  >
                    <img src={awayLogo} alt="" aria-hidden className="h-full w-full object-contain select-none" />
                  </button>
                ) : (
                  <img
                    src={awayLogo}
                    alt=""
                    aria-hidden
                    className="pointer-events-none absolute -left-3 top-1/2 -translate-y-1/2 h-24 w-24 object-contain opacity-30 -rotate-12 select-none"
                  />
                )
              )}
              {!played && (
                <span className="relative z-[1] font-heading font-black uppercase tracking-wider text-base">{game.away_team}</span>
              )}
            </div>
            <div className="text-center">
              {played ? (
                <span className="font-mono font-black text-2xl tabular-nums">{game.away_pts} <span className="text-muted-foreground">-</span> {game.home_pts}</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/40 bg-primary/10 backdrop-blur-sm shadow-[0_0_12px_-4px_hsl(var(--primary)/0.5)]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  <span className="font-heading uppercase tracking-[0.22em] text-[10px] font-bold text-foreground">Scheduled</span>
                </span>
              )}
            </div>
            {/* Home — name on left of watermark */}
            <div className="relative h-20 flex items-center justify-start pl-2 overflow-hidden">
              {homeLogo && (
                played ? (
                  <button
                    type="button"
                    onClick={() => toggleFilter(game.home_team)}
                    aria-label={`Filter by ${game.home_team}`}
                    className={`pointer-events-auto absolute right-0 top-1/2 -translate-y-1/2 h-24 w-24 rotate-12 transition-all duration-200 hover:scale-110 ${filterTeam === game.home_team ? "opacity-100 scale-110 drop-shadow-[0_0_18px_hsl(var(--primary)/0.55)]" : "opacity-40 hover:opacity-95"}`}
                  >
                    <img src={homeLogo} alt="" aria-hidden className="h-full w-full object-contain select-none" />
                  </button>
                ) : (
                  <img
                    src={homeLogo}
                    alt=""
                    aria-hidden
                    className="pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2 h-24 w-24 object-contain opacity-30 rotate-12 select-none"
                  />
                )
              )}
              {!played && (
                <span className="relative z-[1] font-heading font-black uppercase tracking-wider text-base">{game.home_team}</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 py-0 flex-wrap">
            {game.game_boxscore_url && (
              <a href={game.game_boxscore_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-px rounded-xl border">
                <Table2 className="h-3.5 w-3.5" /> BoxScore
              </a>
            )}
            {game.game_charts_url && (
              <a href={game.game_charts_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-px rounded-xl border">
                <BarChart3 className="h-3.5 w-3.5" /> Charts
              </a>
            )}
            {game.game_playbyplay_url && (
              <a href={game.game_playbyplay_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-px rounded-xl border">
                <Mic className="h-3.5 w-3.5" /> PbP
              </a>
            )}
            {game.nba_game_url && (
              <a href={game.nba_game_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-px rounded-xl border">
                <ExternalLink className="h-3.5 w-3.5" /> {leagueName}
              </a>
            )}
          </div>
          {game.game_recap_url && (
            <div className="flex justify-center pt-0">
              <a
                href={game.game_recap_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-green-500 hover:text-green-400 transition-colors px-3 py-0.5 rounded-xl border border-green-500/40"
              >
                <Tv2 className="h-3.5 w-3.5" /> Watch Recap on {recapHost} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
        {played && <GameBoxScoreTable game={game} filterTeam={filterTeam} setFilterTeam={setFilterTeam} />}
        {!played && <ScheduledInsights game={game} />}
      </DialogContent>
    </Dialog>
  );
}

function ScheduledInsights({ game }: { game: GameDetailGame }) {
  const { standingsByTeam, last5DetailByTeam, isLoading } = useStandingsContext();
  const { data: isPreseason } = useIsPreseason();
  const { league } = useLeague();
  const watermarkLogo = league === "wnba" ? wnbaLogo : nbaLogo;

  const a = standingsByTeam[game.away_team];
  const h = standingsByTeam[game.home_team];

  const leagueRank = useMemo(() => {
    const rows = Object.values(standingsByTeam);
    const ranks: Record<string, Record<string, number>> = {};
    const metrics: Array<{ key: keyof typeof rows[number]; lower?: boolean }> = [
      { key: "pct" }, { key: "ppg" }, { key: "oppPpg", lower: true }, { key: "diff" }, { key: "l10W" },
    ];
    for (const m of metrics) {
      const sorted = [...rows].sort((x, y) => {
        const xv = (x as any)[m.key] ?? 0; const yv = (y as any)[m.key] ?? 0;
        return m.lower ? xv - yv : yv - xv;
      });
      sorted.forEach((r, i) => {
        (ranks[r.tricode] ||= {})[m.key as string] = i + 1;
      });
    }
    return ranks;
  }, [standingsByTeam]);

  if (isPreseason) {
    return (
      <div className="border-t bg-muted/20 px-4 py-5">
        <div className="rounded-xl border border-dashed border-border/60 bg-card/40 px-4 py-5 text-center text-xs text-muted-foreground font-heading uppercase tracking-wider">
          Season hasn't started yet
        </div>
      </div>
    );
  }

  if (isLoading || !a || !h) {
    return (
      <div className="border-t bg-muted/20 px-4 py-3 space-y-2">
        <Skeleton className="h-12" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const pill = (r: "W" | "L") => (
    <span
      className={`inline-flex items-center justify-center h-5 w-5 rounded-md text-[10px] font-mono font-black ${
        r === "W" ? "bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/40" : "bg-destructive/20 text-destructive ring-1 ring-destructive/40"
      }`}
    >
      {r}
    </span>
  );

  const RecordBlock = ({ row, side }: { row: typeof a; side: "away" | "home" }) => (
    <div className={`flex flex-col gap-1 ${side === "away" ? "items-end text-right" : "items-start text-left"}`}>
      <div className="font-mono font-black text-lg tabular-nums leading-none">
        {row.w}<span className="text-muted-foreground/60">-</span>{row.l}
      </div>
      <div className="text-[9px] font-heading uppercase tracking-[0.18em] text-muted-foreground">
        {(row.pct * 100).toFixed(1)}% · {side === "away" ? `Away ${row.awayW}-${row.awayL}` : `Home ${row.homeW}-${row.homeL}`}
      </div>
    </div>
  );

  const RankRow = ({ label, metricKey }: { label: string; metricKey: string }) => {
    const ar = leagueRank[game.away_team]?.[metricKey];
    const hr = leagueRank[game.home_team]?.[metricKey];
    const av = (a as any)[metricKey];
    const hv = (h as any)[metricKey];
    const fmt = (v: number) => (metricKey === "pct" ? `${(v * 100).toFixed(1)}%` : metricKey === "l10W" ? String(v) : v.toFixed(1));
    const better = (rank: number | undefined) =>
      rank == null ? "" : rank <= 5 ? "text-emerald-500" : rank >= 26 ? "text-destructive" : "text-foreground";
    return (
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1.5 border-b border-border/30 last:border-b-0">
        <div className="flex items-center justify-end gap-2">
          <span className={`text-[10px] font-mono ${better(ar)}`}>#{ar ?? "—"}</span>
          <span className="font-mono tabular-nums text-xs font-bold">{fmt(av)}</span>
        </div>
        <div className="text-[9px] font-heading uppercase tracking-[0.18em] text-muted-foreground text-center px-2">{label}</div>
        <div className="flex items-center justify-start gap-2">
          <span className="font-mono tabular-nums text-xs font-bold">{fmt(hv)}</span>
          <span className={`text-[10px] font-mono ${better(hr)}`}>#{hr ?? "—"}</span>
        </div>
      </div>
    );
  };

  const last5A = last5DetailByTeam[game.away_team] ?? [];
  const last5H = last5DetailByTeam[game.home_team] ?? [];

  return (
    <div className="relative border-t bg-muted/20">
      <img
        src={watermarkLogo}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 m-auto h-48 w-48 opacity-[0.05] select-none"
      />
      {/* Records strip */}
      <div className="relative z-[1] grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3 border-b border-border/40 bg-background/30">
        <RecordBlock row={a} side="away" />
        <div className="text-[9px] font-heading uppercase tracking-[0.22em] text-muted-foreground">Record</div>
        <RecordBlock row={h} side="home" />
      </div>

      <Tabs defaultValue="form" className="relative z-[1]">
        <TabsList className="w-full justify-center rounded-none bg-transparent border-b border-border/40 h-9 p-0">
          <TabsTrigger value="form" className="text-[10px] font-heading uppercase tracking-wider data-[state=active]:bg-muted/60 rounded-none h-9 px-4 gap-1.5">
            <History className="h-3 w-3" /> Last 5
          </TabsTrigger>
          <TabsTrigger value="ranks" className="text-[10px] font-heading uppercase tracking-wider data-[state=active]:bg-muted/60 rounded-none h-9 px-4 gap-1.5">
            <Trophy className="h-3 w-3" /> League Rankings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="form" className="mt-0 px-4 py-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex items-center justify-end gap-1">
              {last5A.length === 0 && <span className="text-[10px] text-muted-foreground">No games</span>}
              {last5A.map((g, i) => <span key={i}>{pill(g.result)}</span>)}
            </div>
            <div className="text-[9px] font-heading uppercase tracking-[0.22em] text-muted-foreground">Form</div>
            <div className="flex items-center justify-start gap-1">
              {last5H.length === 0 && <span className="text-[10px] text-muted-foreground">No games</span>}
              {last5H.map((g, i) => <span key={i}>{pill(g.result)}</span>)}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="ranks" className="mt-0 px-4 py-2">
          <RankRow label="Win %" metricKey="pct" />
          <RankRow label="PPG" metricKey="ppg" />
          <RankRow label="Opp PPG" metricKey="oppPpg" />
          <RankRow label="Diff" metricKey="diff" />
          <RankRow label="L10 W" metricKey="l10W" />
        </TabsContent>
      </Tabs>
    </div>
  );
}