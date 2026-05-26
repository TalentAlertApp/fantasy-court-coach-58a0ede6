import { useState, useMemo, useRef, useEffect } from "react";
import { getLeagueLogo } from "@/lib/competitions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tv2, ExternalLink, X, MapPin, Columns2 } from "lucide-react";
import { useLeagueTeams } from "@/hooks/useLeagueTeams";
import { useLeague } from "@/contexts/LeagueContext";
import { useStandingsContext } from "@/hooks/useStandingsContext";
import { useIsPreseason } from "@/hooks/useIsPreseason";
import { useLeagueId } from "@/hooks/useLeagueId";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getVenue } from "@/lib/nba-venues";
import { formatTipoffLabel } from "@/hooks/useUpcomingByTeam";
import nbaLogo from "@/assets/nba-logo.svg";
import wnbaLogo from "@/assets/wnba-logo.png";
import GameBoxScoreTable from "@/components/game/GameBoxScoreTable";
import GameActionLinks from "@/components/game/GameActionLinks";
import GameBallersIQLayer from "@/components/game/GameBallersIQLayer";
import GameBallersIQSidePanel from "@/components/game/GameBallersIQSidePanel";
import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import { Sparkles } from "lucide-react";

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
  const nameFor = (tri: string) => leagueTeams.find((t) => t.tricode === tri)?.name ?? tri;
  const awayLogo = logoFor(game.away_team);
  const homeLogo = logoFor(game.home_team);
  const played = isPlayed(game);
  const venue = getVenue(game.home_team);
  const recapHost =
    league === "wnba"
      ? "WNBA.com"
      : league === "euroleague"
        ? "EuroLeagueBasketball.net"
        : "NBA.com";
  const tipoffLabel = game.tipoff_utc ? formatTipoffLabel(game.tipoff_utc) : null;
  const hasGwDay = game.gw != null && game.day != null;
  const [recapOpen, setRecapOpen] = useState(false);
  const [panelsOpen, setPanelsOpen] = useState(false);
  const [biqOn, setBiqOn] = useState(false);
  // When recap is open, BIQ acts as side-panel expansion (mutually exclusive with team-scoring).
  const biqExpanded = recapOpen && biqOn;
  const sidePanelsExpanded = panelsOpen || biqExpanded;
  useEffect(() => { if (!recapOpen) setPanelsOpen(false); }, [recapOpen]);
  // Mutually exclusive expansion modes
  useEffect(() => { if (panelsOpen && biqOn && recapOpen) setBiqOn(false); /* eslint-disable-next-line */ }, [panelsOpen]);
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
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${played ? (recapOpen && sidePanelsExpanded ? "!max-w-[94vw] w-[94vw]" : "max-w-3xl") : "max-w-xl"} rounded-xl p-0 overflow-hidden transition-[max-width] duration-500`}>
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
          {/* Premium BALLERS.IQ label — sits right above the game result */}
          {played && biqOn && (
            <div className="relative flex justify-center pt-1.5 pb-0.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-amber-400/70 bg-gradient-to-r from-amber-300/30 via-amber-400/25 to-amber-300/30 dark:from-amber-400/15 dark:via-amber-400/10 dark:to-amber-400/15 shadow-[0_0_16px_-4px_rgba(252,211,77,0.7)] backdrop-blur-sm">
                <Sparkles className="h-3 w-3 text-amber-600 dark:text-amber-300" />
                <BallersIQBrand variant="wordmark" size="sm" forceTheme="light" transparent className="!h-3 w-auto dark:hidden" />
                <BallersIQBrand variant="wordmark" size="sm" forceTheme="dark" transparent className="!h-3 w-auto hidden dark:block" />
                <span className="text-[8.5px] font-heading font-bold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-200">Live</span>
              </span>
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
                  onClick={() => { if (biqOn) setBiqOn(false); setPanelsOpen((v) => !v); }}
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
          <GameActionLinks
            league={league}
            boxscoreUrl={game.game_boxscore_url}
            chartsUrl={game.game_charts_url}
            playByPlayUrl={game.game_playbyplay_url}
            leagueGameUrl={game.nba_game_url}
          />
          {game.game_recap_url && played && (
            <div className="flex justify-center pt-1.5">
              {embedSrc ? (
                <div className="inline-flex items-center gap-2">
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
                  <BallersIQButton on={biqOn} onClick={() => { if (panelsOpen) setPanelsOpen(false); setBiqOn((v) => !v); }} />
                </div>
              ) : (
                <div className="inline-flex items-center gap-2">
                  <a
                    href={game.game_recap_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-green-500 hover:text-green-400 transition-colors px-3 py-0.5 rounded-xl border border-green-500/40"
                  >
                    <Tv2 className="h-3.5 w-3.5" /> Watch Recap on {recapHost} <ExternalLink className="h-3 w-3" />
                  </a>
                  <BallersIQButton on={biqOn} onClick={() => setBiqOn((v) => !v)} />
                </div>
              )}
            </div>
          )}
          {played && !game.game_recap_url && (
            <div className="flex justify-center pt-1.5">
              <BallersIQButton on={biqOn} onClick={() => setBiqOn((v) => !v)} />
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
        {/* Standalone BIQ layer (only when recap is not open) */}
        {played && biqOn && !recapOpen && (
          <GameBallersIQLayer
            gameId={game.game_id}
            homeTeam={game.home_team}
            awayTeam={game.away_team}
            homePts={game.home_pts}
            awayPts={game.away_pts}
            compact={false}
          />
        )}
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
              gridTemplateColumns: sidePanelsExpanded
                ? "minmax(160px,1fr) 768px minmax(160px,1fr)"
                : "0fr minmax(0,1fr) 0fr",
            }}
          >
            <div
              className={`relative bg-background overflow-hidden border-r border-border/40 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${sidePanelsExpanded ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"}`}
              style={{ height: embedHeight }}
            >
              {biqExpanded ? (
                <GameBallersIQSidePanel
                  side="left"
                  gameId={game.game_id}
                  homeTeam={game.home_team}
                  awayTeam={game.away_team}
                  homePts={game.home_pts}
                  awayPts={game.away_pts}
                />
              ) : (
                <GameBoxScoreTable game={game} filterTeam={game.away_team} setFilterTeam={() => {}} density="compact" fillHeight />
              )}
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
              className={`relative bg-background overflow-hidden border-l border-border/40 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${sidePanelsExpanded ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none"}`}
              style={{ height: embedHeight }}
            >
              {biqExpanded ? (
                <GameBallersIQSidePanel
                  side="right"
                  gameId={game.game_id}
                  homeTeam={game.home_team}
                  awayTeam={game.away_team}
                  homePts={game.home_pts}
                  awayPts={game.away_pts}
                />
              ) : (
                <GameBoxScoreTable game={game} filterTeam={game.home_team} setFilterTeam={() => {}} density="compact" fillHeight />
              )}
            </div>
          </div>
        )}
        {!played && <ScheduledInsights game={game} />}
      </DialogContent>
    </Dialog>
    </>
  );
}

function BallersIQButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={on ? "Disable Ballers.IQ Live" : "Activate Ballers.IQ Live"}
      className={`inline-flex items-center gap-1.5 text-xs px-3 py-0.5 rounded-xl border transition-all hover:scale-[1.04] ${
        on
          ? "border-amber-300/70 bg-amber-400/15 text-amber-100 shadow-[0_0_18px_-4px_rgba(252,211,77,0.7)]"
          : "border-amber-400/40 bg-black/40 text-amber-200/85 hover:border-amber-300/70 hover:bg-amber-400/10"
      }`}
    >
      <Sparkles className="h-3.5 w-3.5" />
      <BallersIQBrand variant="wordmark" size="sm" forceTheme="dark" transparent className="!h-3.5 w-auto" />
      {on && <span className="text-[9.5px] font-heading uppercase tracking-[0.2em]">Live</span>}
    </button>
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
        <H2HSection
          teamA={game.away_team}
          teamB={game.home_team}
          onOpenGame={(g) => setHistoryGame(g)}
        />
      </div>

      <GameDetailModal
        game={historyGame}
        open={historyGame !== null}
        onOpenChange={(o) => !o && setHistoryGame(null)}
      />
    </div>
  );
}

function H2HSection({
  teamA,
  teamB,
  onOpenGame,
}: {
  teamA: string;
  teamB: string;
  onOpenGame: (g: GameDetailGame) => void;
}) {
  const { data: leagueId } = useLeagueId();
  const { teams: leagueTeams } = useLeagueTeams();
  const logoFor = (tri: string) => leagueTeams.find((t) => t.tricode === tri)?.logo;

  const { data: h2h, isLoading } = useQuery({
    queryKey: ["game-modal-h2h", teamA, teamB, leagueId],
    enabled: !!teamA && !!teamB && !!leagueId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("*")
        .eq("league_id", leagueId!)
        .or(
          `and(home_team.eq.${teamA},away_team.eq.${teamB}),and(home_team.eq.${teamB},away_team.eq.${teamA})`,
        )
        .order("tipoff_utc", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="px-4 py-3 border-t border-border/40">
      <h3 className="text-[10px] font-heading uppercase tracking-[0.25em] text-muted-foreground mb-2">
        Head-to-Head — This Season
      </h3>
      {isLoading ? (
        <Skeleton className="h-24" />
      ) : !h2h || h2h.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card/40 px-4 py-6 text-center text-xs text-muted-foreground font-heading uppercase tracking-wider">
          No matchups recorded
        </div>
      ) : (
        <div className="space-y-1.5">
          {h2h.map((g: any) => {
            const isFinal = g.status?.toUpperCase().includes("FINAL");
            const aIsHome = g.home_team === teamA;
            const opp = aIsHome ? g.away_team : g.home_team;
            const oppLogo = logoFor(opp);
            const date = g.tipoff_utc
              ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", day: "numeric", month: "short", year: "numeric" }).format(new Date(g.tipoff_utc))
              : "—";
            return (
              <button
                type="button"
                key={g.game_id}
                onClick={() =>
                  onOpenGame({
                    game_id: g.game_id,
                    home_team: g.home_team,
                    away_team: g.away_team,
                    home_pts: g.home_pts,
                    away_pts: g.away_pts,
                    status: g.status,
                    game_boxscore_url: g.game_boxscore_url,
                    game_charts_url: g.game_charts_url,
                    game_playbyplay_url: g.game_playbyplay_url,
                    game_recap_url: g.game_recap_url,
                    nba_game_url: g.nba_game_url,
                    youtube_recap_id: g.youtube_recap_id,
                    tipoff_utc: g.tipoff_utc,
                    gw: g.gw ?? null,
                    day: g.day ?? null,
                    played: !!isFinal,
                  })
                }
                className="w-full grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-border/50 bg-card/60 hover:bg-accent/30 hover:border-primary/40 transition-all px-3 py-2 text-left group"
              >
                <div className="flex items-center justify-end gap-2">
                  <span className="text-xs font-heading font-bold uppercase">{aIsHome ? "vs" : "@"} {opp}</span>
                  {oppLogo && <img src={oppLogo} alt="" className="w-5 h-5 object-contain" />}
                </div>
                <div className="flex items-center gap-2 min-w-[120px] justify-center">
                  {isFinal ? (
                    <>
                      <span className={`font-mono text-base ${(aIsHome ? g.home_pts : g.away_pts) > (aIsHome ? g.away_pts : g.home_pts) ? "font-black text-foreground" : "text-muted-foreground"}`}>
                        {aIsHome ? g.home_pts : g.away_pts}
                      </span>
                      <span className="text-muted-foreground text-xs">—</span>
                      <span className={`font-mono text-base ${(aIsHome ? g.away_pts : g.home_pts) > (aIsHome ? g.home_pts : g.away_pts) ? "font-black text-foreground" : "text-muted-foreground"}`}>
                        {aIsHome ? g.away_pts : g.home_pts}
                      </span>
                    </>
                  ) : (
                    <span className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
                      {g.status ?? "Scheduled"}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono inline-flex items-center gap-1">
                  {date}
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}