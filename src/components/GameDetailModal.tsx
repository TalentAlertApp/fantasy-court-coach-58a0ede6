import { useState, useMemo, useRef, useEffect } from "react";
import { getLeagueLogo } from "@/lib/competitions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tv2, Table2, BarChart3, Mic, ExternalLink, X, MapPin, Columns2 } from "lucide-react";
import { useLeagueTeams } from "@/hooks/useLeagueTeams";
import { useLeague } from "@/contexts/LeagueContext";
import { useStandingsContext } from "@/hooks/useStandingsContext";
import { useIsPreseason } from "@/hooks/useIsPreseason";
import { getVenue } from "@/lib/nba-venues";
import { formatTipoffLabel } from "@/hooks/useUpcomingByTeam";
import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";
import GameBoxScoreTable from "@/components/game/GameBoxScoreTable";

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
  youtube_recap_id?: string | null;
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
  const [recapOpen, setRecapOpen] = useState(false);
  const [panelsOpen, setPanelsOpen] = useState(false);
  useEffect(() => { if (!recapOpen) setPanelsOpen(false); }, [recapOpen]);
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const [embedHeight, setEmbedHeight] = useState<number>(420);
  useEffect(() => {
    if (recapOpen) return;
    const h = tableWrapRef.current?.offsetHeight;
    if (h && h > 200) setEmbedHeight(h);
  }, [recapOpen]);
  const embedSrc = useMemo(
    () => toYouTubeEmbed(game.game_recap_url ?? null, game.youtube_recap_id ?? null),
    [game.game_recap_url, game.youtube_recap_id],
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${played ? (recapOpen && panelsOpen ? "!max-w-[82vw] w-[82vw]" : "max-w-2xl") : "max-w-xl"} rounded-xl p-0 overflow-hidden transition-[max-width] duration-500`}>
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
          {(hasGwDay || tipoffLabel || venue?.name) && (
            <div className="relative flex items-center justify-center gap-2 flex-wrap">
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
              {venue?.name && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-px rounded-md border border-border/60 bg-background/40 backdrop-blur-sm text-[10px] font-heading uppercase tracking-[0.16em] font-semibold text-foreground/80 max-w-[260px] truncate"
                  title={venue.name}
                >
                  <MapPin className="h-2.5 w-2.5 opacity-70" /> {venue.name}
                </span>
              )}
            </div>
          )}
          <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-2">
            {/* Away — name on right of watermark */}
            <div className="relative h-28 flex items-center justify-end pr-2 overflow-hidden">
              {awayLogo && (
                <img
                  src={awayLogo}
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute -left-4 top-1/2 -translate-y-1/2 h-32 w-32 object-contain opacity-30 -rotate-12 select-none"
                />
              )}
              {!played && (
                <span className="relative z-[1] font-heading font-black uppercase tracking-wider text-base">{game.away_team}</span>
              )}
            </div>
            <div className="relative text-center">
              {played ? (
                <span className="font-mono font-black text-3xl tabular-nums">{game.away_pts} <span className="text-muted-foreground">-</span> {game.home_pts}</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-primary/40 bg-primary/10 backdrop-blur-sm shadow-[0_0_12px_-4px_hsl(var(--primary)/0.5)]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  <span className="font-heading uppercase tracking-[0.22em] text-[10px] font-bold text-foreground">Scheduled</span>
                </span>
              )}
              {recapOpen && embedSrc && (
                <button
                  type="button"
                  onClick={() => setPanelsOpen((v) => !v)}
                  aria-pressed={panelsOpen}
                  aria-label={panelsOpen ? "Hide team scoring panels" : "Show team scoring panels"}
                  title={panelsOpen ? "Hide team scoring" : "Show team scoring"}
                  className={`absolute left-1/2 -translate-x-1/2 -bottom-3 transition-all hover:scale-110 ${panelsOpen ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                >
                  <Columns2 className="h-4 w-4" />
                </button>
              )}
            </div>
            {/* Home — name on left of watermark */}
            <div className="relative h-28 flex items-center justify-start pl-2 overflow-hidden">
              {homeLogo && (
                <img
                  src={homeLogo}
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute -right-4 top-1/2 -translate-y-1/2 h-32 w-32 object-contain opacity-30 rotate-12 select-none"
                />
              )}
              {!played && (
                <span className="relative z-[1] font-heading font-black uppercase tracking-wider text-base">{game.home_team}</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-center gap-1.5 -mt-5 py-0 flex-wrap">
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
          {game.game_recap_url && played && (
            <div className="flex justify-center pt-1.5">
              {embedSrc ? (
                <button
                  type="button"
                  onClick={() => setRecapOpen((v) => !v)}
                  aria-label={recapOpen ? "Close recap video" : "Watch recap video"}
                  title={recapOpen ? "Close recap" : "Watch Recap"}
                  className="inline-flex items-center gap-1.5 text-xs text-green-500 hover:text-green-400 transition-all px-3 py-0.5 rounded-xl border border-green-500/40 hover:border-green-400 hover:bg-green-500/10 hover:scale-[1.04]"
                >
                  {recapOpen ? <X className="h-3.5 w-3.5" /> : <Tv2 className="h-3.5 w-3.5" />}
                  {recapOpen ? "Close Recap" : "Watch Recap"}
                </button>
              ) : (
                <a
                  href={game.game_recap_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-green-500 hover:text-green-400 transition-colors px-3 py-0.5 rounded-xl border border-green-500/40"
                >
                  <Tv2 className="h-3.5 w-3.5" /> Watch Recap on {recapHost} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
          {game.game_recap_url && !played && (
            <div className="flex justify-center pt-1.5">
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
        {played && !recapOpen && (
          <div ref={tableWrapRef} className="border-t">
            <GameBoxScoreTable game={game} />
          </div>
        )}
        {played && recapOpen && embedSrc && (
          <div
            className="border-t bg-black relative overflow-hidden grid transition-[grid-template-columns] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              minHeight: embedHeight,
              gridTemplateColumns: panelsOpen ? "minmax(0,1fr) minmax(0,2fr) minmax(0,1fr)" : "0fr minmax(0,1fr) 0fr",
            }}
          >
            <div
              className={`relative bg-background overflow-hidden border-r border-border/40 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${panelsOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"}`}
              style={{ height: embedHeight }}
            >
              <GameBoxScoreTable game={game} filterTeam={game.away_team} setFilterTeam={() => {}} density="compact" fillHeight />
            </div>
            <div className="relative z-10 transform-gpu" style={{ height: embedHeight }}>
              <iframe
                src={embedSrc}
                title="Game Recap"
                className="absolute inset-0 w-full h-full transition-opacity duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ opacity: 1 }}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div
              className={`relative bg-background overflow-hidden border-l border-border/40 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${panelsOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none"}`}
              style={{ height: embedHeight }}
            >
              <GameBoxScoreTable game={game} filterTeam={game.home_team} setFilterTeam={() => {}} density="compact" fillHeight />
            </div>
          </div>
        )}
        {!played && <ScheduledInsights game={game} />}
      </DialogContent>
    </Dialog>
  );
}

/** Convert YouTube watch / youtu.be URLs (or a raw video id) into embeddable URLs. */
function toYouTubeEmbed(url: string | null, ytId?: string | null): string | null {
  if (ytId && /^[A-Za-z0-9_-]{6,}$/.test(ytId)) {
    return `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`;
  }
  if (!url) return null;
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname.includes("youtu.be")) {
      id = u.pathname.replace(/^\//, "").split("/")[0] || null;
    } else if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return url;
      id = u.searchParams.get("v");
      if (!id && u.pathname.startsWith("/shorts/")) {
        id = u.pathname.split("/")[2] ?? null;
      }
    }
    if (!id) return null;
    return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
  } catch {
    return null;
  }
}

function ScheduledInsights({ game }: { game: GameDetailGame }) {
  const { standingsByTeam, last5DetailByTeam, isLoading } = useStandingsContext();
  const { data: isPreseason } = useIsPreseason();
  const { league } = useLeague();
  const watermarkLogo = getLeagueLogo(league);
  const [historyGame, setHistoryGame] = useState<GameDetailGame | null>(null);

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
    if (isLoading) {
      return (
        <div className="border-t bg-muted/20 px-4 py-3 space-y-2">
          <Skeleton className="h-12" />
          <Skeleton className="h-32" />
        </div>
      );
    }
    // Standings unavailable (e.g. early-season WNBA / no FINAL games yet).
    return (
      <div className="border-t bg-muted/20 px-4 py-5">
        <div className="rounded-xl border border-dashed border-border/60 bg-card/40 px-4 py-5 text-center text-xs text-muted-foreground space-y-1">
          <div className="font-heading uppercase tracking-wider">Pre-game preview</div>
          <div className="text-[11px]">No completed games yet — standings &amp; form will appear once results come in.</div>
        </div>
      </div>
    );
  }

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

  const openHistory = (g: typeof last5A[number]) => {
    if (!g.game_id) return;
    setHistoryGame({
      game_id: g.game_id,
      home_team: g.homeTeam,
      away_team: g.awayTeam,
      home_pts: g.homePts,
      away_pts: g.awayPts,
      status: "FINAL",
      played: true,
      game_boxscore_url: g.game_boxscore_url ?? null,
      game_charts_url: g.game_charts_url ?? null,
      game_playbyplay_url: g.game_playbyplay_url ?? null,
      game_recap_url: g.game_recap_url ?? null,
      nba_game_url: g.nba_game_url ?? null,
      youtube_recap_id: (g as any).youtube_recap_id ?? null,
    });
  };

  const PillBtn = ({ g }: { g: typeof last5A[number] }) => (
    <button
      type="button"
      onClick={() => openHistory(g)}
      disabled={!g.game_id}
      className={`inline-flex items-center justify-center h-5 w-5 rounded-md text-[10px] font-mono font-black transition-transform ${g.game_id ? "cursor-pointer hover:scale-110" : "cursor-default opacity-70"} ${
        g.result === "W" ? "bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/40" : "bg-destructive/20 text-destructive ring-1 ring-destructive/40"
      }`}
      title={g.game_id ? `vs ${g.opp} · ${g.ownPts}-${g.oppPts}` : undefined}
    >
      {g.result}
    </button>
  );

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

      <div className="relative z-[1]">
        <div className="px-4 py-3 border-b border-border/40">
          <div className="text-[9px] font-heading uppercase tracking-[0.22em] text-muted-foreground text-center mb-2">Last 5 · Form</div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex items-center justify-end gap-1">
              {last5A.length === 0 && <span className="text-[10px] text-muted-foreground">No games</span>}
              {last5A.map((g, i) => <PillBtn key={i} g={g} />)}
            </div>
            <div className="text-[9px] font-heading uppercase tracking-[0.22em] text-muted-foreground">vs</div>
            <div className="flex items-center justify-start gap-1">
              {last5H.length === 0 && <span className="text-[10px] text-muted-foreground">No games</span>}
              {last5H.map((g, i) => <PillBtn key={i} g={g} />)}
            </div>
          </div>
        </div>
        <div className="px-4 py-2">
          <div className="text-[9px] font-heading uppercase tracking-[0.22em] text-muted-foreground text-center mb-1">League Rankings</div>
          <RankRow label="Win %" metricKey="pct" />
          <RankRow label="PPG" metricKey="ppg" />
          <RankRow label="Opp PPG" metricKey="oppPpg" />
          <RankRow label="Diff" metricKey="diff" />
          <RankRow label="L10 W" metricKey="l10W" />
        </div>
      </div>

      <GameDetailModal
        game={historyGame}
        open={historyGame !== null}
        onOpenChange={(o) => !o && setHistoryGame(null)}
      />
    </div>
  );
}