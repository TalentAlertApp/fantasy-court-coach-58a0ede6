import { useState, useMemo, useEffect, Fragment } from "react";
import { z } from "zod";
import { ScheduleGameSchema } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { getTeamLogo, getTeamByTricode } from "@/lib/nba-teams";
import { useGameBoxscoreQuery } from "@/hooks/useGameBoxscoreQuery";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, ExternalLink, Tv2, Table2, BarChart3, Mic, Star, Eye, Swords, Bandage, Maximize2 } from "lucide-react";
import PlayerModal from "@/components/PlayerModal";
import TeamModal from "@/components/TeamModal";
import InjuryReportModal from "@/components/InjuryReportModal";
import { useQuery, useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NBA_TEAM_META } from "@/data/nbaTeamsFallback";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueId } from "@/hooks/useLeagueId";
import { useLeagueTeams } from "@/hooks/useLeagueTeams";
import { WNBA_TEAMS } from "@/lib/wnba-teams";
import { format } from "date-fns";
import { getVenue } from "@/lib/nba-venues";
import TeamCompareModal from "@/components/TeamCompareModal";
import { fetchGameBoxscore, fetchPlayers } from "@/lib/api";
import { buildOutstandingBlurb, buildWatchBlurb } from "@/lib/game-blurbs";
import { pickGameLeader, pickWatchLeader } from "@/lib/game-blurbs";
import GameBoxScoreTable from "@/components/game/GameBoxScoreTable";
import GameDetailModal, { type GameDetailGame } from "@/components/GameDetailModal";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import {
  normalizePlayerHealth,
  isHealthUnavailable,
  isHealthRisky,
  getHealthLabel,
  type PlayerHealth,
} from "@/lib/health";
import { HealthStatusIcon } from "@/components/health";

/* ---------- League-aware team meta (conference) ---------- */
// Conference grouping is only defined for NBA/WNBA. EuroLeague uses a single
// league table, so we accept its code in the union but return an empty meta
// map (callers branch on registry.standingsMode before grouping).
type LeagueCode = "nba" | "wnba" | "euroleague";
const WNBA_META: Record<string, { conference: "East" | "West" }> = Object.fromEntries(
  WNBA_TEAMS.map((t) => [t.tricode, { conference: t.conference === "Eastern" ? "East" : "West" }]),
);
function getLeagueMeta(league: LeagueCode): Record<string, { conference: "East" | "West" }> {
  if (league === "wnba") return WNBA_META;
  if (league === "euroleague") return {};
  return NBA_TEAM_META as unknown as Record<string, { conference: "East" | "West" }>;
}

/* ---------- Recap Card (inline YouTube / NBA.com fallback) ---------- */
function RecapCard({ url, youtubeRecapId, awayTeam, homeTeam }: {
  url?: string | null;
  youtubeRecapId?: string | null;
  awayTeam: string;
  homeTeam: string;
}) {
  const [nbaExpanded, setNbaExpanded] = useState(false);
  const [nbaBlocked, setNbaBlocked] = useState(false);
  const { league } = useLeague();
  const recapHost =
    league === "wnba" ? "WNBA.com" : league === "euroleague" ? "EuroLeague.net" : "NBA.com";
  // WNBA.com sends X-Frame-Options: SAMEORIGIN on its game pages, so an
  // inline <iframe> always renders blank. Force outbound for WNBA when there
  // is no YouTube embed available.
  const forceOutbound = league === "wnba";

  // Case 1: YouTube embed available — best inline experience
  if (youtubeRecapId) {
    return (
      <div className="relative w-full h-full rounded-xl overflow-hidden bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeRecapId}?rel=0&modestbranding=1`}
          title="Game Recap"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full border-0"
        />
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 text-[10px] font-heading uppercase tracking-wider text-white bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg px-2 py-1 border border-white/20 transition-colors"
            title={`Open on ${recapHost}`}
          >
            {recapHost} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    );
  }

  // Case 2: NBA.com URL only — try inline iframe with graceful fallback
  if (url && nbaExpanded && !nbaBlocked && !forceOutbound) {
    return (
      <div className="relative w-full h-full rounded-xl overflow-hidden bg-black">
        <iframe
          src={url}
          title={`${recapHost} Recap`}
          referrerPolicy="no-referrer-when-downgrade"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          onError={() => {
            setNbaBlocked(true);
            window.open(url, "_blank", "noopener,noreferrer");
          }}
          className="w-full h-full border-0"
        />
      </div>
    );
  }

  // Case 3: Nothing
  if (!url) {
    return (
      <div className="flex w-full h-full items-center justify-center rounded-xl bg-muted/30 text-sm text-muted-foreground p-6 text-center">
        Official recap unavailable
      </div>
    );
  }

  // NBA.com placeholder (click to expand inline)
  const awayLogo = getTeamLogo(awayTeam);
  const homeLogo = getTeamLogo(homeTeam);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (forceOutbound) {
          // WNBA.com cannot be iframed — open in a new tab instead.
          window.open(url, "_blank", "noopener,noreferrer");
        } else {
          setNbaExpanded(true);
        }
      }}
      className="group relative flex w-full h-full flex-col items-center justify-center gap-3 rounded-xl bg-gradient-to-br from-card via-muted/40 to-card border overflow-hidden hover:border-green-500/50 transition-colors"
    >
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="flex items-center gap-4">
          {awayLogo && <img src={awayLogo} alt="" className="w-14 h-14 object-contain drop-shadow" />}
          <span className="font-heading text-xs uppercase text-muted-foreground tracking-wider">@</span>
          {homeLogo && <img src={homeLogo} alt="" className="w-14 h-14 object-contain drop-shadow" />}
        </div>
        <p className="text-sm font-heading font-bold uppercase tracking-wider text-foreground/90 group-hover:text-green-500 transition-colors">
          {forceOutbound ? `Watch Recap on ${recapHost} ↗` : "Watch Recap"}
        </p>
      </div>
    </button>
  );
}

type ScheduleGame = z.infer<typeof ScheduleGameSchema>;

import GameCardBadges, { type GameBadge as BIQGameBadge } from "@/components/ballers-iq/GameCardBadges";

interface ScheduleListProps {
  games: ScheduleGame[];
  viewMode?: "list" | "grid";
  gameBadges?: Record<string, BIQGameBadge[]>;
}

function formatTipoff(utc: string): string {
  const d = new Date(utc);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function getStatusBorder(status: string): string {
  const s = status.toUpperCase();
  if (s.includes("FINAL")) return "border-l-green-500";
  if (isLiveStatusString(s)) return "border-l-red-500";
  return "border-l-[hsl(var(--nba-yellow))]";
}

function isGameFinal(status: string) {
  return status.toUpperCase().includes("FINAL");
}

/** Any non-FINAL / non-SCHEDULED status from the source sheet (e.g. "Q1 5:29",
 *  "HALF", "OT 2:14") indicates the game is in progress. */
function isLiveStatusString(s: string): boolean {
  const u = s.toUpperCase().trim();
  if (!u) return false;
  if (u === "LIVE" || u === "IN_PROGRESS") return true;
  return /^(Q[1-4]|END|HALF|OT|DELAY)/.test(u);
}

/** Live window heuristic: server status does not flip to LIVE in real time,
 *  so we treat a game as LIVE from tipoff until tipoff + 2h30m, unless its
 *  status is already FINAL. */
const LIVE_WINDOW_MS = 2.5 * 60 * 60 * 1000;
function isGameLive(status: string, tipoff_utc?: string | null, nowMs: number = Date.now()) {
  const s = status.toUpperCase();
  if (isLiveStatusString(s)) return true;
  if (s.includes("FINAL")) return false;
  if (!tipoff_utc) return false;
  const t = new Date(tipoff_utc).getTime();
  if (!Number.isFinite(t)) return false;
  return nowMs >= t && nowMs < t + LIVE_WINDOW_MS;
}

/** When the sheet provides a real live status ("Q1 5:29"), surface it next to
 *  the LIVE badge so users see the actual game state. */
function getLiveStatusLabel(status: string): string | null {
  const u = (status ?? "").trim();
  if (!u) return null;
  if (/^FINAL/i.test(u) || /^SCHEDULED$/i.test(u) || /^LIVE$/i.test(u) || /^IN_PROGRESS$/i.test(u)) return null;
  return u;
}

function GameBoxScore({ gameId, awayTeam, homeTeam, recapUrl, youtubeRecapId, onOpenModal }: {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  recapUrl?: string | null;
  youtubeRecapId?: string | null;
  onPlayerClick?: (playerId: number) => void;
  onOpenModal?: () => void;
}) {
  return (
    <div className="relative border-t bg-muted/20 grid grid-cols-[1fr_auto] items-stretch">
      {onOpenModal && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenModal(); }}
          aria-label="Open full game modal"
          title="Open full game view"
          className="absolute top-1.5 right-1.5 z-20 inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-primary hover:bg-background/70 backdrop-blur-sm border border-border/40 transition-colors"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="min-w-0">
        <GameBoxScoreTable
          game={{ game_id: gameId, away_team: awayTeam, home_team: homeTeam }}
          maxBodyHeightClass="max-h-[360px]"
        />
      </div>
      <div className="w-[640px] shrink-0 border-l aspect-video self-stretch">
        <RecapCard url={recapUrl} youtubeRecapId={youtubeRecapId} awayTeam={awayTeam} homeTeam={homeTeam} />
      </div>
    </div>
  );
}

function GameActionIcon({ icon: Icon, url, label, className: extraClass }: {
  icon: typeof Tv2; url: string | null | undefined; label: string;
  className?: string;
}) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`text-muted-foreground hover:text-primary transition-colors p-0.5 ${extraClass ?? ""}`}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

/** Centered, italic, single-line player blurb. */
function GameCardBlurb({
  kind,
  text,
  awayPhoto,
  awayPlayerId,
  homePhoto,
  homePlayerId,
  onPlayerClick,
}: {
  kind: "outstanding" | "watch";
  text: string | null;
  awayPhoto?: string | null;
  awayPlayerId?: number | null;
  homePhoto?: string | null;
  homePlayerId?: number | null;
  onPlayerClick?: (id: number) => void;
}) {
  if (!text) return null;
  const isOut = kind === "outstanding";
  const Icon = isOut ? Star : Eye;
  const labelColor = isOut ? "text-[hsl(var(--nba-yellow))]" : "text-primary";
  const ariaLabel = isOut ? "Outstanding Players" : "Players to Watch";
  const PhotoBtn = ({ photo, id, side }: { photo?: string | null; id?: number | null; side: "left" | "right" }) =>
    photo && id ? (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onPlayerClick?.(id); }}
        className="shrink-0 rounded-full overflow-hidden ring-1 ring-border/50 transition-transform duration-200 hover:scale-125 hover:ring-amber-400/70"
        aria-label="Open player"
      >
        <img src={photo} alt="" className="h-7 w-7 object-cover object-top" />
      </button>
    ) : null;
  return (
    <div
      className="relative z-10 flex items-center justify-center gap-1.5 px-2 py-0.5 max-w-full"
      aria-label={ariaLabel}
    >
      <PhotoBtn photo={awayPhoto} id={awayPlayerId} side="left" />
      <Icon className={`h-3 w-3 shrink-0 ${labelColor}`} aria-hidden />
      <span className="text-[10px] md:text-[10.5px] font-medium italic text-foreground/90 text-center leading-snug whitespace-pre-line">
        {text
          .replace(/;\s*/g, "\n")
          .replace(/\.\s*$/, "")}
      </span>
      <PhotoBtn photo={homePhoto} id={homePlayerId} side="right" />
    </div>
  );
}

interface Last5Game {
  won: boolean;
  date: string;
  opp: string;
  venue: "H" | "A";
  game_id: string;
  game_boxscore_url: string | null;
  game_charts_url: string | null;
  game_playbyplay_url: string | null;
  game_recap_url: string | null;
  nba_game_url: string | null;
  youtube_recap_id: string | null;
  home_team: string;
  away_team: string;
  home_pts: number;
  away_pts: number;
}

interface TeamFormData {
  tricode: string;
  w: number;
  l: number;
  pct: string;
  gb: string;
  homeRec: string;
  awayRec: string;
  last5: Last5Game[];
}

function useAllTeamsForm(enabled: boolean) {
  const { data: leagueId } = useLeagueId();
  const { league } = useLeague();
  return useQuery({
    queryKey: ["all-teams-form", leagueId],
    enabled: enabled && !!leagueId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("game_id, home_team, away_team, home_pts, away_pts, status, tipoff_utc, game_boxscore_url, game_charts_url, game_playbyplay_url, game_recap_url, nba_game_url, youtube_recap_id")
        .eq("league_id", leagueId!)
        .ilike("status", "%FINAL%")
        .order("tipoff_utc", { ascending: true });
      if (error) throw error;
      if (!data) return {};

      const result: Record<string, TeamFormData> = {};

      const acc: Record<string, { w: number; l: number; homeW: number; homeL: number; awayW: number; awayL: number; games: Last5Game[] }> = {};
      const ensure = (t: string) => { if (!acc[t]) acc[t] = { w: 0, l: 0, homeW: 0, homeL: 0, awayW: 0, awayL: 0, games: [] }; };

      for (const g of data) {
        ensure(g.home_team);
        ensure(g.away_team);
        const homeWon = g.home_pts > g.away_pts;
        const dateStr = g.tipoff_utc ? format(new Date(g.tipoff_utc), "dd/MM/yy") : "—";
        const shared = {
          game_id: g.game_id, game_boxscore_url: g.game_boxscore_url, game_charts_url: g.game_charts_url,
          game_playbyplay_url: g.game_playbyplay_url, game_recap_url: g.game_recap_url,
          nba_game_url: g.nba_game_url, youtube_recap_id: g.youtube_recap_id,
          home_team: g.home_team, away_team: g.away_team, home_pts: g.home_pts, away_pts: g.away_pts,
        };

        if (homeWon) {
          acc[g.home_team].w++; acc[g.home_team].homeW++;
          acc[g.away_team].l++; acc[g.away_team].awayL++;
        } else {
          acc[g.home_team].l++; acc[g.home_team].homeL++;
          acc[g.away_team].w++; acc[g.away_team].awayW++;
        }

        acc[g.home_team].games.push({ won: homeWon, date: dateStr, opp: g.away_team, venue: "H", ...shared });
        acc[g.away_team].games.push({ won: !homeWon, date: dateStr, opp: g.home_team, venue: "A", ...shared });
      }

      let bestDiff = -Infinity;
      for (const t of Object.values(acc)) {
        const diff = t.w - t.l;
        if (diff > bestDiff) bestDiff = diff;
      }

      // Include every team in the active league so conference standings are full.
      const leagueMeta = getLeagueMeta(league);
      const allTricodes = new Set<string>([...Object.keys(leagueMeta), ...Object.keys(acc)]);
      for (const tricode of allTricodes) {
        const t = acc[tricode];
        if (!t) {
          result[tricode] = { tricode, w: 0, l: 0, pct: ".000", gb: "-", homeRec: "0-0", awayRec: "0-0", last5: [] };
          continue;
        }
        const gp = t.w + t.l;
        const pct = gp > 0 ? (t.w / gp).toFixed(3).replace(/^0/, "") : ".000";
        const gbVal = (bestDiff - (t.w - t.l)) / 2;
        const gb = gbVal === 0 ? "-" : gbVal.toFixed(1);
        const last5 = t.games.slice(-5);
        result[tricode] = {
          tricode,
          w: t.w,
          l: t.l,
          pct,
          gb,
          homeRec: `${t.homeW}-${t.homeL}`,
          awayRec: `${t.awayW}-${t.awayL}`,
          last5,
        };
      }

      return result;
    },
    staleTime: 60_000,
  });
}

function GameDetailDialog({ game, open, onOpenChange }: { game: Last5Game | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const detail: GameDetailGame | null = game
    ? {
        game_id: game.game_id,
        home_team: game.home_team,
        away_team: game.away_team,
        home_pts: game.home_pts,
        away_pts: game.away_pts,
        status: "FINAL",
        played: true,
        game_boxscore_url: game.game_boxscore_url,
        game_charts_url: game.game_charts_url,
        game_playbyplay_url: game.game_playbyplay_url,
        game_recap_url: game.game_recap_url,
        nba_game_url: game.nba_game_url,
        youtube_recap_id: game.youtube_recap_id,
      }
    : null;
  return <GameDetailModal game={detail} open={open} onOpenChange={onOpenChange} />;
}

function computeConfStandings(data: Record<string, TeamFormData>, tricode: string, league: LeagueCode): { tricode: string; rank: number; w: number; l: number; gp: number; pctStr: string; gb: string }[] {
  const leagueMeta = getLeagueMeta(league);
  const meta = leagueMeta[tricode];
  if (!meta || !data) return [];
  const conference = meta.conference;
  const allTeams = Object.keys(leagueMeta).filter(t => leagueMeta[t].conference === conference);
  const rows = allTeams.map(t => {
    const d = data[t];
    const w = d?.w ?? 0;
    const l = d?.l ?? 0;
    const gp = w + l;
    return { tricode: t, w, l, gp, pct: gp > 0 ? w / gp : 0 };
  }).sort((a, b) => b.pct - a.pct || b.w - a.w);
  const bestDiff = rows.length > 0 ? rows[0].w - rows[0].l : 0;
  const ranked = rows.map((r, i) => ({
    tricode: r.tricode, rank: i + 1, w: r.w, l: r.l, gp: r.gp,
    pctStr: r.gp > 0 ? (r.w / r.gp).toFixed(3).replace(/^0/, "") : ".000",
    gb: i === 0 ? "-" : ((bestDiff - (r.w - r.l)) / 2).toFixed(1),
  }));
  const idx = ranked.findIndex(r => r.tricode === tricode);
  let start = Math.max(0, idx - 2);
  if (start + 5 > ranked.length) start = Math.max(0, ranked.length - 5);
  return ranked.slice(start, start + 5);
}

function ConferenceTable({ standings, teamTricode, onTeamClick, league }: {
  standings: ReturnType<typeof computeConfStandings>;
  teamTricode: string;
  onTeamClick: (tricode: string) => void;
  league: LeagueCode;
}) {
  const meta = getLeagueMeta(league)[teamTricode];
  if (!standings.length || !meta) return null;
  return (
    <div className="bg-card/60 rounded-lg border p-2">
      <p className="text-[9px] font-heading font-bold text-muted-foreground uppercase mb-1">{meta.conference} Conference</p>
      <div className="grid grid-cols-[24px_20px_36px_28px_28px_28px_36px_32px] gap-0 text-[10px]">
        <span className="font-heading text-muted-foreground">#</span>
        <span></span>
        <span className="font-heading text-muted-foreground">Team</span>
        <span className="text-right font-heading text-muted-foreground">GP</span>
        <span className="text-right font-heading text-muted-foreground">W</span>
        <span className="text-right font-heading text-muted-foreground">L</span>
        <span className="text-right font-heading text-muted-foreground">PCT</span>
        <span className="text-right font-heading text-muted-foreground">GB</span>
        {standings.map((r) => {
          const isThis = r.tricode === teamTricode;
          const rLogo = getTeamLogo(r.tricode);
          return (
            <div key={r.tricode} className={`contents ${isThis ? "font-bold" : ""}`}>
              <span className={`py-0.5 ${isThis ? "text-primary" : "text-muted-foreground"}`}>{r.rank}</span>
              <button onClick={() => onTeamClick(r.tricode)} className="py-0.5">
                {rLogo && <img src={rLogo} alt={r.tricode} className="w-3.5 h-3.5 hover:scale-125 transition-transform" />}
              </button>
              <button onClick={() => onTeamClick(r.tricode)} className={`py-0.5 text-left font-heading hover:underline ${isThis ? "text-primary" : ""}`}>{r.tricode}</button>
              <span className="py-0.5 text-right font-mono">{r.gp}</span>
              <span className="py-0.5 text-right font-mono">{r.w}</span>
              <span className="py-0.5 text-right font-mono">{r.l}</span>
              <span className="py-0.5 text-right font-mono">{r.pctStr}</span>
              <span className="py-0.5 text-right font-mono text-muted-foreground">{r.gb}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UpcomingGamePreview({ awayTeam, homeTeam, onGameClick, onTeamClick }: {
  awayTeam: string; homeTeam: string;
  onGameClick: (game: Last5Game) => void;
  onTeamClick: (tricode: string) => void;
}) {
  const { data, isLoading } = useAllTeamsForm(true);
  const { league } = useLeague();

  const awayStandings = useMemo(() => data ? computeConfStandings(data, awayTeam, league) : [], [data, awayTeam, league]);
  const homeStandings = useMemo(() => data ? computeConfStandings(data, homeTeam, league) : [], [data, homeTeam, league]);

  if (isLoading) return <div className="p-3"><Skeleton className="h-16" /></div>;
  if (!data) return null;

  const away = data[awayTeam];
  const home = data[homeTeam];
  if (!away || !home) return null;

  const teamsArr: { team: TeamFormData; standings: ReturnType<typeof computeConfStandings> }[] = [
    { team: away, standings: awayStandings },
    { team: home, standings: homeStandings },
  ];

  return (
    <div className="border-t bg-muted/20 px-4 py-3">
      <div className="grid grid-cols-2 gap-4">
        {teamsArr.map(({ team, standings }) => {
          const logo = getTeamLogo(team.tricode);
          const meta = getLeagueMeta(league)[team.tricode];

          return (
            <div key={team.tricode} className="space-y-2">
              <div className="flex items-center gap-2">
                {logo && <img src={logo} alt={team.tricode} className="w-8 h-8" />}
                <span className="font-heading font-bold text-sm uppercase">{team.tricode}</span>
                {meta && <span className="text-xs text-muted-foreground">{meta.conference}</span>}
              </div>

              <div className="grid grid-cols-4 gap-1.5 text-xs">
                <div>
                  <span className="text-muted-foreground">W-L</span>
                  <p className="font-mono font-bold">{team.w}-{team.l}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">PCT</span>
                  <p className="font-mono font-bold">{team.pct}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">HOME</span>
                  <p className="font-mono">{team.homeRec}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">AWAY</span>
                  <p className="font-mono">{team.awayRec}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ConferenceTable standings={standings} teamTricode={team.tricode} onTeamClick={onTeamClick} league={league} />
                <div className="bg-card/60 rounded-lg border p-2">
                  <p className="text-[9px] font-heading font-bold text-muted-foreground uppercase mb-1">Last 5 Games</p>
                  <div className="space-y-1">
                    {team.last5.map((g, i) => {
                      const oppLogo = getTeamLogo(g.opp);
                      const recapHref = g.game_recap_url ?? null;
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <button onClick={() => onGameClick(g)}>
                            <Badge
                              variant={g.won ? "default" : "destructive"}
                              className="text-[8px] px-1.5 py-0 rounded-xl h-4 min-w-[18px] justify-center font-heading font-bold cursor-pointer hover:opacity-80"
                            >
                              {g.won ? "W" : "L"}
                            </Badge>
                          </button>
                          <span className="text-muted-foreground font-mono w-14">{g.date}</span>
                          <button className="flex items-center gap-0.5 hover:underline" onClick={() => onTeamClick(g.opp)}>
                            {oppLogo && <img src={oppLogo} alt={g.opp} className="w-3.5 h-3.5" />}
                            <span className="font-heading font-bold">{g.opp}</span>
                          </button>
                          <span className="text-muted-foreground text-[9px]">{g.venue === "H" ? "Home" : "Away"}</span>
                          <div className="ml-auto">
                            {recapHref ? (
                              <a
                                href={recapHref}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-green-500 hover:text-green-400 p-0.5 inline-flex"
                                title="Watch Recap"
                              >
                                <Tv2 className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground/30 p-0.5 inline-flex" title="Recap unavailable">
                                <Tv2 className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {team.last5.length === 0 && <span className="text-[10px] text-muted-foreground">No games played</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function useColsPerRow() {
  const [cols, setCols] = useState(() => {
    if (typeof window === "undefined") return 4;
    const w = window.innerWidth;
    if (w >= 1280) return 4;
    if (w >= 1024) return 3;
    if (w >= 640) return 2;
    return 1;
  });
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      if (w >= 1280) setCols(4);
      else if (w >= 1024) setCols(3);
      else if (w >= 640) setCols(2);
      else setCols(1);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return cols;
}

/** Compact, context-sensitive injury bandage that opens InjuryReportModal for the matchup. */
function GameInjuryButton({
  awayTeam,
  homeTeam,
  rosterOut,
  rosterRisk,
  teamInjuriesCount,
  size = "sm",
  onClick,
}: {
  awayTeam: string;
  homeTeam: string;
  rosterOut: number;
  rosterRisk: number;
  teamInjuriesCount: number;
  size?: "xs" | "sm";
  onClick: () => void;
}) {
  const tier =
    rosterOut > 0 ? "danger" : rosterRisk > 0 ? "warning" : teamInjuriesCount > 0 ? "neutral" : "muted";
  const tone =
    tier === "danger"
      ? "text-red-500 hover:text-red-400 drop-shadow-[0_0_4px_rgba(239,68,68,0.45)]"
      : tier === "warning"
      ? "text-amber-400 hover:text-amber-300"
      : tier === "neutral"
      ? "text-foreground/70 hover:text-foreground"
      : "text-muted-foreground/60 hover:text-muted-foreground";
  const titleParts = [`Open Injury Report — ${awayTeam} & ${homeTeam}`];
  if (rosterOut > 0) titleParts.push(`${rosterOut} roster player${rosterOut > 1 ? "s" : ""} listed OUT`);
  if (rosterRisk > 0) titleParts.push(`${rosterRisk} availability risk${rosterRisk > 1 ? "s" : ""} on your roster`);
  if (rosterOut === 0 && rosterRisk === 0 && teamInjuriesCount > 0)
    titleParts.push(`${teamInjuriesCount} team injur${teamInjuriesCount > 1 ? "ies" : "y"} in this matchup`);
  const title = titleParts.join(" • ");
  const total = rosterOut + rosterRisk;
  const iconCls = size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`inline-flex items-center gap-0.5 transition-colors p-0.5 ${tone}`}
      title={title}
      aria-label={title}
    >
      <Bandage className={iconCls} />
      {total > 0 ? (
        <span className="text-[9px] font-heading font-bold leading-none">{total}</span>
      ) : teamInjuriesCount > 0 ? (
        <span className="text-[9px] font-mono leading-none opacity-80">{teamInjuriesCount}</span>
      ) : null}
    </button>
  );
}

/** Inline strip listing roster-affected players for the matchup. */
function MatchupHealthStrip({
  gh,
  isFinal,
  onPlayerClick,
}: {
  gh: {
    rosterOut: { id: number; name: string; team: string; photo?: string | null; health: PlayerHealth }[];
    rosterRisk: { id: number; name: string; team: string; photo?: string | null; health: PlayerHealth }[];
    teamInjuriesCount: number;
  };
  isFinal: boolean;
  onPlayerClick: (id: number) => void;
}) {
  const items = [...gh.rosterOut, ...gh.rosterRisk];
  if (items.length === 0) return null;
  const headline = isFinal
    ? "Roster injury context"
    : `${gh.rosterOut.length > 0 ? `${gh.rosterOut.length} OUT` : ""}${
        gh.rosterOut.length > 0 && gh.rosterRisk.length > 0 ? " • " : ""
      }${gh.rosterRisk.length > 0 ? `${gh.rosterRisk.length} at risk` : ""}`;
  return (
    <div className={`border-b ${isFinal ? "bg-muted/10" : "bg-muted/30"} px-4 py-2 flex items-center gap-3 flex-wrap`}>
      <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-muted-foreground shrink-0">
        {headline}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {items.map((p) => {
          const teamLogo = getTeamLogo(p.team);
          const tone = isHealthUnavailable(p.health)
            ? "border-red-500/40 bg-red-500/10"
            : "border-amber-400/40 bg-amber-400/10";
          return (
            <button
              key={p.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); onPlayerClick(p.id); }}
              className={`inline-flex items-center gap-1.5 rounded-full border ${tone} pl-0.5 pr-2 py-0.5 hover:scale-[1.03] transition-transform`}
              title={`${p.name} — ${getHealthLabel(p.health)}`}
              aria-label={`Open ${p.name} (${getHealthLabel(p.health)})`}
            >
              {p.photo ? (
                <img src={p.photo} alt="" className="h-5 w-5 rounded-full object-cover object-top ring-1 ring-border/50" />
              ) : (
                <span className="h-5 w-5 rounded-full bg-muted" />
              )}
              {teamLogo && <img src={teamLogo} alt={p.team} className="h-3.5 w-3.5" />}
              <span className="text-[11px] font-heading font-bold leading-none">{p.name}</span>
              <HealthStatusIcon health={p.health} size="xs" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ScheduleList({ games, viewMode = "grid", gameBadges }: ScheduleListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedTeamTricode, setSelectedTeamTricode] = useState<string | null>(null);
  const [selectedLast5Game, setSelectedLast5Game] = useState<Last5Game | null>(null);
  const [comparePair, setComparePair] = useState<{ a: string; b: string } | null>(null);
  const [injuryPair, setInjuryPair] = useState<{ a: string; b: string } | null>(null);
  const [modalGame, setModalGame] = useState<GameDetailGame | null>(null);
  const openGameModal = (g: ScheduleGame) => {
    setExpandedId(null);
    setModalGame({
      game_id: g.game_id,
      home_team: g.home_team,
      away_team: g.away_team,
      home_pts: g.home_pts ?? 0,
      away_pts: g.away_pts ?? 0,
      status: g.status,
      played: isGameFinal(g.status),
      game_boxscore_url: g.game_boxscore_url ?? null,
      game_charts_url: g.game_charts_url ?? null,
      game_playbyplay_url: g.game_playbyplay_url ?? null,
      game_recap_url: g.game_recap_url ?? null,
      nba_game_url: g.nba_game_url ?? null,
      youtube_recap_id: (g as any).youtube_recap_id ?? null,
      gw: g.gw ?? null,
      day: g.day ?? null,
      tipoff_utc: g.tipoff_utc ?? null,
    });
  };
  const colsPerRow = useColsPerRow();
  // Hydrate the EuroLeague team registry so getVenue() can resolve venue
  // backdrops on /schedule cards (NBA/WNBA already use static catalogs).
  useLeagueTeams();

  // Prefetch box-scores for finished games so "Outstanding Players" blurbs render inline.
  const finalGameIds = games.filter((g) => isGameFinal(g.status)).map((g) => g.game_id);
  const boxscoreQueries = useQueries({
    queries: finalGameIds.map((id) => ({
      queryKey: ["game-boxscore", id],
      queryFn: () => fetchGameBoxscore(id),
      staleTime: 5 * 60_000,
      enabled: viewMode === "list",
    })),
  });
  const boxscoreById = useMemo(() => {
    const map: Record<string, any> = {};
    finalGameIds.forEach((id, i) => {
      const q = boxscoreQueries[i];
      if (q?.data?.players) map[id] = q.data.players;
    });
    return map;
  }, [boxscoreQueries, finalGameIds]);

  // Prefetch players list for "Players to Watch" on scheduled games.
  const { league } = useLeague();
  const { data: playersData } = useQuery({
    queryKey: ["players", league, { limit: 1000 }],
    queryFn: () => fetchPlayers({ limit: 1000 }),
    staleTime: 60_000,
    enabled: games.length > 0,
  });
  const playerItems: any[] = (playersData as any)?.items ?? [];

  // ---------- Roster-aware health context for matchups ----------
  const { data: rosterData } = useRosterQuery();
  const rosterIds = useMemo(() => {
    const set = new Set<number>();
    const slots = (rosterData as any)?.roster ?? (rosterData as any)?.slots ?? [];
    if (Array.isArray(slots)) {
      for (const s of slots) {
        const pid = s?.player_id ?? s?.player?.id ?? s?.id;
        if (typeof pid === "number") set.add(pid);
      }
    }
    return set;
  }, [rosterData]);

  type AffectedPlayer = {
    id: number;
    name: string;
    team: string;
    photo?: string | null;
    health: PlayerHealth;
  };
  type GameHealth = {
    rosterOut: AffectedPlayer[];
    rosterRisk: AffectedPlayer[];
    teamInjuriesCount: number;
  };

  const healthByTeam = useMemo(() => {
    const map = new Map<string, AffectedPlayer[]>();
    for (const p of playerItems) {
      const c = p?.core;
      if (!c?.team) continue;
      const h = normalizePlayerHealth(c);
      if (!h.status) continue;
      const arr = map.get(c.team) ?? [];
      arr.push({ id: c.id, name: c.name, team: c.team, photo: c.photo, health: h });
      map.set(c.team, arr);
    }
    return map;
  }, [playerItems]);

  const computeGameHealth = (awayTeam: string, homeTeam: string): GameHealth => {
    const out: GameHealth = { rosterOut: [], rosterRisk: [], teamInjuriesCount: 0 };
    for (const team of [awayTeam, homeTeam]) {
      const arr = healthByTeam.get(team) ?? [];
      for (const item of arr) {
        if (rosterIds.has(item.id)) {
          if (isHealthUnavailable(item.health)) out.rosterOut.push(item);
          else if (isHealthRisky(item.health)) out.rosterRisk.push(item);
          else out.teamInjuriesCount++;
        } else {
          out.teamInjuriesCount++;
        }
      }
    }
    return out;
  };

  if (games.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-heading uppercase">No Games Scheduled</p>
        <p className="text-sm font-body">Try navigating to a different day</p>
      </div>
    );
  }

  const renderExpandedPanel = (g: ScheduleGame) => {
    const isFinal = isGameFinal(g.status);
    const isScheduled = !isFinal && !isGameLive(g.status, g.tipoff_utc);
    const gh = computeGameHealth(g.away_team, g.home_team);
    return (
      <div className={`bg-card border border-l-4 ${isFinal ? "border-l-green-500" : "border-l-transparent"} rounded-xl overflow-hidden`}>
        {(gh.rosterOut.length > 0 || gh.rosterRisk.length > 0) && (
          <MatchupHealthStrip
            gh={gh}
            isFinal={isFinal}
            onPlayerClick={setSelectedPlayerId}
          />
        )}
        {isFinal && (
          <GameBoxScore
            gameId={g.game_id}
            awayTeam={g.away_team}
            homeTeam={g.home_team}
            recapUrl={g.game_recap_url}
            youtubeRecapId={g.youtube_recap_id}
            onPlayerClick={setSelectedPlayerId}
            onOpenModal={() => openGameModal(g)}
          />
        )}
        {isScheduled && (
          <UpcomingGamePreview awayTeam={g.away_team} homeTeam={g.home_team} onGameClick={setSelectedLast5Game} onTeamClick={setSelectedTeamTricode} />
        )}
      </div>
    );
  };

  const renderCard = (g: ScheduleGame, compact: boolean) => {
    const isFinal = isGameFinal(g.status);
    const isLive = isGameLive(g.status, g.tipoff_utc);
    const isScheduled = !isFinal && !isLive;
    const isExpandable = isFinal || isScheduled;
    const isExpanded = expandedId === g.game_id;
    const hasYoutubeRecap = !!g.youtube_recap_id;
    const venue = getVenue(g.home_team);
    const gh = computeGameHealth(g.away_team, g.home_team);
    const showInjuryBtn =
      isScheduled || gh.rosterOut.length > 0 || gh.rosterRisk.length > 0;

    // GameNight Arena Card v2 — premium broadcast accents per status
    const statusRingExpanded = isLive
      ? "ring-2 ring-red-500/70 shadow-[0_0_24px_-4px_rgb(239,68,68,0.55)]"
      : isFinal
        ? "ring-2 ring-green-500/70 shadow-[0_0_24px_-4px_rgb(34,197,94,0.55)]"
        : "ring-2 ring-[hsl(var(--nba-yellow))]/80 shadow-[0_0_24px_-4px_hsl(var(--nba-yellow)/0.55)]";
    const statusGlowHover = isLive
      ? "hover:shadow-[0_0_18px_-6px_rgb(239,68,68,0.45)]"
      : isFinal
        ? "hover:shadow-[0_0_18px_-6px_rgb(34,197,94,0.45)]"
        : "hover:shadow-[0_0_18px_-6px_hsl(var(--nba-yellow)/0.45)]";
    const statusPillText = isLive
      ? "text-red-500"
      : isFinal
        ? "text-green-500"
        : "text-[hsl(var(--nba-yellow))]";

    return (
      <div
        onClick={() => isExpandable && setExpandedId(isExpanded ? null : g.game_id)}
        className={`relative overflow-hidden bg-card rounded-xl border border-l-4 ${getStatusBorder(g.status)} ${
          isGameLive(g.status, g.tipoff_utc) ? "border-l-red-500 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-red-500 before:animate-pulse before:z-10" : ""
        } ${
          compact ? "group/card flex flex-col px-3 pt-2 pb-2.5 gap-2 transition-all duration-200 " + statusGlowHover : "flex items-center px-5 py-3"
        } ${isExpandable ? "cursor-pointer hover:bg-muted/40 transition-colors" : ""} ${
          isExpanded && !compact ? "rounded-b-none border-b-0" : ""
        } ${isExpanded && compact ? statusRingExpanded : ""}`}
      >
        {venue?.image && (
          <img
            src={venue.image}
            alt=""
            aria-hidden
            loading="lazy"
            className={`pointer-events-none absolute inset-0 w-full h-full object-cover opacity-[0.28] dark:opacity-[0.42] ${compact ? "transition-transform duration-500 group-hover/card:scale-[1.04] group-hover/card:opacity-[0.5]" : ""}`}
          />
        )}
        {compact ? (
          <>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-card/85 via-card/30 to-card/95" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,hsl(var(--card)/0.55)_100%)]" />
          </>
        ) : (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card via-card/30 to-card" />
        )}
        {gameBadges && gameBadges[g.game_id] && gameBadges[g.game_id].length > 0 && (
          <div className="absolute top-1.5 right-2 z-20 pointer-events-none">
            <GameCardBadges badges={gameBadges[g.game_id]} />
          </div>
        )}

        {compact ? (
          <>
            {/* Top status strip */}
            <div className="relative z-10 flex items-center justify-between gap-2">
              <span className={`font-heading font-black text-[10px] tracking-[0.14em] uppercase leading-none ${statusPillText} ${isLive ? "animate-pulse" : ""}`}>
                {isLive ? "LIVE" : isFinal ? "FINAL" : "SCHEDULED"}
              </span>
              {g.tipoff_utc && !isFinal && (
                <span className="text-[10px] font-mono font-bold text-foreground/80 tracking-wide leading-none">
                  {formatTipoff(g.tipoff_utc)}
                </span>
              )}
              {isLive && getLiveStatusLabel(g.status) && (
                <span className="text-[10px] font-mono font-bold text-red-500/90 tracking-wide leading-none">
                  {getLiveStatusLabel(g.status)}
                </span>
              )}
            </div>

            {/* Center matchup stage: large team badges with @ in middle */}
            <div className="relative z-10 flex items-center justify-center gap-3 py-1">
              <div className="flex flex-col items-center gap-0.5">
                {getTeamLogo(g.away_team) && (
                  <img
                    src={getTeamLogo(g.away_team)}
                    alt={g.away_team}
                    className="w-16 h-16 transition-transform duration-200 hover:scale-110 drop-shadow-[0_0_22px_hsl(var(--accent)/0.55)] group-hover/card:drop-shadow-[0_0_28px_hsl(var(--accent)/0.7)]"
                  />
                )}
                <span className="font-heading font-black text-[11px] uppercase tracking-wider">{g.away_team}</span>
                {(isFinal || isLive) && (
                  <span className={`font-mono leading-none tabular-nums ${isFinal && g.away_pts > g.home_pts ? "font-black text-lg text-foreground" : "font-bold text-base opacity-70"}`}>{g.away_pts}</span>
                )}
              </div>
              <div className="flex flex-col items-center justify-center gap-0.5 px-2 min-w-[44px]">
                <span className="text-[11px] text-muted-foreground/70 font-heading font-black tracking-widest">VS</span>
                <span className="block h-px w-6 bg-gradient-to-r from-transparent via-foreground/30 to-transparent" />
              </div>
              <div className="flex flex-col items-center gap-0.5">
                {getTeamLogo(g.home_team) && (
                  <img
                    src={getTeamLogo(g.home_team)}
                    alt={g.home_team}
                    className="w-16 h-16 transition-transform duration-200 hover:scale-110 drop-shadow-[0_0_22px_hsl(var(--accent)/0.55)] group-hover/card:drop-shadow-[0_0_28px_hsl(var(--accent)/0.7)]"
                  />
                )}
                <span className="font-heading font-black text-[11px] uppercase tracking-wider">{g.home_team}</span>
                {(isFinal || isLive) && (
                  <span className={`font-mono leading-none tabular-nums ${isFinal && g.home_pts > g.away_pts ? "font-black text-lg text-foreground" : "font-bold text-base opacity-70"}`}>{g.home_pts}</span>
                )}
              </div>
            </div>

            {/* Bottom info + action dock */}
            <div className="relative z-10 flex items-center justify-between gap-2 pt-1 border-t border-foreground/5">
              {venue?.name ? (
                <span className="text-[10px] italic text-muted-foreground/90 truncate min-w-0 flex-1" title={venue.name}>
                  {venue.name}
                </span>
              ) : <span className="flex-1" />}
              <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover/card:opacity-100 transition-opacity">
                {isFinal && (
                  <span
                    onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : g.game_id); }}
                    className={`p-0.5 cursor-pointer transition-all duration-200 hover:scale-125 hover:-translate-y-0.5 ${hasYoutubeRecap ? "text-green-500 hover:brightness-125" : "text-muted-foreground hover:text-primary"}`}
                    title="Game Recap"
                  >
                    <Tv2 className="h-3.5 w-3.5" />
                  </span>
                )}
                {showInjuryBtn && (
                  <GameInjuryButton
                    awayTeam={g.away_team}
                    homeTeam={g.home_team}
                    rosterOut={gh.rosterOut.length}
                    rosterRisk={gh.rosterRisk.length}
                    teamInjuriesCount={gh.teamInjuriesCount}
                    size="xs"
                    onClick={() => setInjuryPair({ a: g.away_team, b: g.home_team })}
                  />
                )}
                <GameActionIcon icon={Table2} url={g.game_boxscore_url} label="Box Score" />
                <GameActionIcon icon={BarChart3} url={g.game_charts_url} label="Charts" />
                <GameActionIcon icon={Mic} url={g.game_playbyplay_url} label="Play-by-Play" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setComparePair({ a: g.away_team, b: g.home_team }); }}
                  className="text-muted-foreground hover:text-[hsl(var(--nba-yellow))] transition-all duration-200 hover:scale-125 hover:-translate-y-0.5"
                  title={`Compare ${g.away_team} vs ${g.home_team}`}
                >
                  <Swords className="h-3.5 w-3.5" />
                </button>
                {g.nba_game_url && (
                  <a
                    href={g.nba_game_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-primary transition-all duration-200 hover:scale-125 hover:-translate-y-0.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                {isExpandable && (
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Teams */}
            <div className="relative z-10 flex items-center gap-3 flex-1">
              <div className="flex items-center gap-2 justify-end text-right flex-1">
                <p className="font-heading font-bold text-sm uppercase leading-none whitespace-nowrap">{getTeamByTricode(g.away_team)?.name ?? g.away_team}</p>
                {(isFinal || isLive) && (
                  <span className={`text-2xl font-mono leading-none tabular-nums ${
                    isFinal && g.away_pts > g.home_pts ? "font-black" : "font-normal opacity-60"
                  }`}>{g.away_pts}</span>
                )}
                {getTeamLogo(g.away_team) && (
                  <img src={getTeamLogo(g.away_team)} alt={g.away_team} className="w-12 h-12 transition-transform hover:scale-110" />
                )}
              </div>

              {/* Center: status */}
              <div className="flex flex-col items-center justify-center min-w-[80px] min-h-[60px] gap-0.5 leading-none">
                <span className="text-muted-foreground text-[10px] font-heading font-bold leading-none">@</span>
                {isLive ? (
                  <>
                    <span className="text-sm font-heading font-black text-destructive animate-pulse leading-none">LIVE</span>
                    {getLiveStatusLabel(g.status) && (
                      <span className="text-[10px] font-mono font-bold text-destructive/80 tracking-wide leading-none">
                        {getLiveStatusLabel(g.status)}
                      </span>
                    )}
                  </>
                ) : (
                  <span className={`text-sm font-heading font-bold leading-none ${isFinal ? "text-green-600" : "text-muted-foreground"}`}>
                    {g.status}
                  </span>
                )}
                {g.tipoff_utc && (
                  <span className="text-xs font-mono font-bold text-muted-foreground leading-none">
                    {formatTipoff(g.tipoff_utc)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 justify-start text-left flex-1">
                {getTeamLogo(g.home_team) && (
                  <img src={getTeamLogo(g.home_team)} alt={g.home_team} className="w-12 h-12 transition-transform hover:scale-110" />
                )}
                {(isFinal || isLive) && (
                  <span className={`text-2xl font-mono leading-none tabular-nums ${
                    isFinal && g.home_pts > g.away_pts ? "font-black" : "font-normal opacity-60"
                  }`}>{g.home_pts}</span>
                )}
                <p className="font-heading font-bold text-sm uppercase leading-none whitespace-nowrap">{getTeamByTricode(g.home_team)?.name ?? g.home_team}</p>
              </div>
            </div>

            {/* Right: action icons */}
            <div className="relative z-10 flex items-center gap-1.5">
              {venue?.name && (
                <span
                  className="hidden sm:inline-block text-[10px] italic text-muted-foreground/80 truncate max-w-[140px] mr-1"
                  title={venue.name}
                >
                  {venue.name}
                </span>
              )}
              {isFinal && (
                <span
                  onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : g.game_id); }}
                  className={`p-0.5 cursor-pointer transition-colors ${hasYoutubeRecap ? "text-green-500" : "text-muted-foreground hover:text-primary"}`}
                  title="Game Recap"
                >
                  <Tv2 className="h-4 w-4" />
                </span>
              )}
                {showInjuryBtn && (
                  <GameInjuryButton
                    awayTeam={g.away_team}
                    homeTeam={g.home_team}
                    rosterOut={gh.rosterOut.length}
                    rosterRisk={gh.rosterRisk.length}
                    teamInjuriesCount={gh.teamInjuriesCount}
                    onClick={() => setInjuryPair({ a: g.away_team, b: g.home_team })}
                  />
                )}
              <GameActionIcon icon={Table2} url={g.game_boxscore_url} label="Box Score" />
              <GameActionIcon icon={BarChart3} url={g.game_charts_url} label="Charts" />
              <GameActionIcon icon={Mic} url={g.game_playbyplay_url} label="Play-by-Play" />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setComparePair({ a: g.away_team, b: g.home_team }); }}
                className="text-muted-foreground hover:text-[hsl(var(--nba-yellow))] transition-colors"
                title={`Compare ${g.away_team} vs ${g.home_team}`}
              >
                <Swords className="h-4 w-4" />
              </button>
              {g.nba_game_url && (
                <a
                  href={g.nba_game_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {isExpandable && (
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  const expandedGame = expandedId ? games.find((x) => x.game_id === expandedId) : null;
  const expandedIndex = expandedGame ? games.findIndex((x) => x.game_id === expandedId) : -1;

  if (viewMode === "grid") {
    const rowOfExpanded = expandedIndex >= 0 ? Math.floor(expandedIndex / colsPerRow) : -1;
    const lastIndexOfRow = rowOfExpanded >= 0 ? Math.min((rowOfExpanded + 1) * colsPerRow - 1, games.length - 1) : -1;

    return (
      <div className="grid gap-2 px-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {games.map((g, i) => (
          <Fragment key={g.game_id}>
            <div className="p-px">{renderCard(g, true)}</div>
            {i === lastIndexOfRow && expandedGame && (
              <div className="col-span-full">
                {renderExpandedPanel(expandedGame)}
              </div>
            )}
          </Fragment>
        ))}

        <PlayerModal
          playerId={selectedPlayerId}
          open={selectedPlayerId !== null}
          onOpenChange={(open) => !open && setSelectedPlayerId(null)}
        />
        <TeamModal
          tricode={selectedTeamTricode}
          open={selectedTeamTricode !== null}
          onOpenChange={(open) => !open && setSelectedTeamTricode(null)}
        />
        <GameDetailDialog
          game={selectedLast5Game}
          open={selectedLast5Game !== null}
          onOpenChange={(open) => !open && setSelectedLast5Game(null)}
        />
        <TeamCompareModal
          teamA={comparePair?.a ?? null}
          teamB={comparePair?.b ?? null}
          open={comparePair !== null}
          onOpenChange={(open) => !open && setComparePair(null)}
        />
        <InjuryReportModal
          open={injuryPair !== null}
          onOpenChange={(open) => !open && setInjuryPair(null)}
          initialTeams={injuryPair ? [injuryPair.a, injuryPair.b] : undefined}
        />
        <GameDetailModal
          game={modalGame}
          open={modalGame !== null}
          onOpenChange={(o) => !o && setModalGame(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2 px-1">
      {games.map((g) => {
        const isFinal = isGameFinal(g.status);
        const isLive = isGameLive(g.status, g.tipoff_utc);
        const isScheduled = !isFinal && !isLive;
        const isExpandable = isFinal || isScheduled;
        const isExpanded = expandedId === g.game_id;
        const hasYoutubeRecap = !!g.youtube_recap_id;
        const venue = getVenue(g.home_team);
        const gh = computeGameHealth(g.away_team, g.home_team);
        const showInjuryBtn =
          isScheduled || gh.rosterOut.length > 0 || gh.rosterRisk.length > 0;

        return (
          <Collapsible
            key={g.game_id}
            open={isExpanded}
            onOpenChange={() => isExpandable && setExpandedId(isExpanded ? null : g.game_id)}
          >
            <CollapsibleTrigger asChild disabled={!isExpandable}>
              <div
                className={`relative overflow-hidden bg-card rounded-xl border border-l-4 ${getStatusBorder(g.status)} ${
                  isGameLive(g.status, g.tipoff_utc) ? "border-l-red-500 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-red-500 before:animate-pulse before:z-10" : ""
                } flex flex-col px-5 py-3 ${
                  isExpandable ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""
                } ${isExpanded ? "rounded-b-none border-b-0" : ""}`}
              >
                {venue?.image && (
                  <img
                    src={venue.image}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-[0.28] dark:opacity-[0.40]"
                  />
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card via-card/30 to-card" />
        {gameBadges && gameBadges[g.game_id] && gameBadges[g.game_id].length > 0 && (
          <div className="absolute top-1.5 right-2 z-20 pointer-events-none">
            <GameCardBadges badges={gameBadges[g.game_id]} />
          </div>
        )}

                <div className="relative z-10 flex min-h-[64px] items-center w-full">
                {/* Left: player blurb */}
                <div className="relative z-20 min-w-0 w-[28%] max-w-[360px] px-1 flex items-center justify-start">
                  {isFinal && (() => {
                    const box = boxscoreById[g.game_id] ?? [];
                    const a = pickGameLeader(box, g.away_team);
                    const h = pickGameLeader(box, g.home_team);
                    return (
                      <GameCardBlurb
                        kind="outstanding"
                        text={buildOutstandingBlurb(box, g.away_team, g.home_team)}
                        awayPhoto={(a as any)?.photo} awayPlayerId={a?.player_id ?? null}
                        homePhoto={(h as any)?.photo} homePlayerId={h?.player_id ?? null}
                        onPlayerClick={setSelectedPlayerId}
                      />
                    );
                  })()}
                  {isScheduled && (() => {
                    const a = pickWatchLeader(playerItems, g.away_team);
                    const h = pickWatchLeader(playerItems, g.home_team);
                    return (
                      <GameCardBlurb
                        kind="watch"
                        text={buildWatchBlurb(playerItems, g.away_team, g.home_team)}
                        awayPhoto={a?.core.photo ?? null} awayPlayerId={a?.core.id ?? null}
                        homePhoto={h?.core.photo ?? null} homePlayerId={h?.core.id ?? null}
                        onPlayerClick={setSelectedPlayerId}
                      />
                    );
                  })()}
                </div>

                {/* Center: Teams + status (absolute center of the card) */}
                <div className="absolute inset-y-0 left-1/2 z-10 grid w-[min(760px,calc(100%-2rem))] -translate-x-1/2 grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)] items-center gap-3">
                  <div className="flex min-w-0 items-center gap-2 justify-end text-right overflow-hidden">
                    <p className="min-w-0 truncate font-heading font-bold text-sm uppercase leading-none whitespace-nowrap">{getTeamByTricode(g.away_team)?.name ?? g.away_team}</p>
                    {(isFinal || isLive) && (
                      <span className={`shrink-0 text-2xl font-mono leading-none tabular-nums ${
                        isFinal && g.away_pts > g.home_pts ? "font-black" : "font-normal opacity-60"
                      }`}>{g.away_pts}</span>
                    )}
                    {getTeamLogo(g.away_team) && (
                      <img src={getTeamLogo(g.away_team)} alt={g.away_team} className="w-12 h-12 shrink-0 transition-transform hover:scale-110" />
                    )}
                  </div>

                  {/* Center: status */}
                  <div className="flex flex-col items-center justify-center min-w-[80px] min-h-[60px] gap-0.5 leading-none">
                    <span className="text-muted-foreground text-[10px] font-heading font-bold leading-none">@</span>
                    {isLive ? (
                      <>
                        <span className="text-sm font-heading font-black text-destructive animate-pulse leading-none">LIVE</span>
                        {getLiveStatusLabel(g.status) && (
                          <span className="text-[10px] font-mono font-bold text-destructive/80 tracking-wide leading-none">
                            {getLiveStatusLabel(g.status)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className={`text-sm font-heading font-bold leading-none ${isFinal ? "text-green-600" : "text-muted-foreground"}`}>
                        {g.status}
                      </span>
                    )}
                    {g.tipoff_utc && (
                      <span className="text-xs font-mono font-bold text-muted-foreground leading-none">
                        {formatTipoff(g.tipoff_utc)}
                      </span>
                    )}
                  </div>

                  <div className="flex min-w-0 items-center gap-2 justify-start text-left overflow-hidden">
                    {getTeamLogo(g.home_team) && (
                      <img src={getTeamLogo(g.home_team)} alt={g.home_team} className="w-12 h-12 shrink-0 transition-transform hover:scale-110" />
                    )}
                    {(isFinal || isLive) && (
                      <span className={`shrink-0 text-2xl font-mono leading-none tabular-nums ${
                        isFinal && g.home_pts > g.away_pts ? "font-black" : "font-normal opacity-60"
                      }`}>{g.home_pts}</span>
                    )}
                    <p className="min-w-0 truncate font-heading font-bold text-sm uppercase leading-none whitespace-nowrap">{getTeamByTricode(g.home_team)?.name ?? g.home_team}</p>
                  </div>
                </div>

                {/* Right: action icons */}
                <div className="relative z-20 ml-auto flex items-center gap-1.5">
                  {venue?.name && (
                    <span
                      className="hidden sm:inline-block text-[10px] italic text-muted-foreground/80 truncate max-w-[140px] mr-1"
                      title={venue.name}
                    >
                      {venue.name}
                    </span>
                  )}
                  {isFinal && (
                    <span
                      onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : g.game_id); }}
                      className={`p-0.5 cursor-pointer transition-colors ${hasYoutubeRecap ? "text-green-500" : "text-muted-foreground hover:text-primary"}`}
                      title="Game Recap"
                    >
                      <Tv2 className="h-4 w-4" />
                    </span>
                  )}
                  {showInjuryBtn && (
                    <GameInjuryButton
                      awayTeam={g.away_team}
                      homeTeam={g.home_team}
                      rosterOut={gh.rosterOut.length}
                      rosterRisk={gh.rosterRisk.length}
                      teamInjuriesCount={gh.teamInjuriesCount}
                      onClick={() => setInjuryPair({ a: g.away_team, b: g.home_team })}
                    />
                  )}
                  <GameActionIcon icon={Table2} url={g.game_boxscore_url} label="Box Score" />
                  <GameActionIcon icon={BarChart3} url={g.game_charts_url} label="Charts" />
                  <GameActionIcon icon={Mic} url={g.game_playbyplay_url} label="Play-by-Play" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setComparePair({ a: g.away_team, b: g.home_team }); }}
                    className="text-muted-foreground hover:text-[hsl(var(--nba-yellow))] transition-colors"
                    title={`Compare ${g.away_team} vs ${g.home_team}`}
                  >
                    <Swords className="h-4 w-4" />
                  </button>
                  {g.nba_game_url && (
                    <a
                      href={g.nba_game_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  {isExpandable && (
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  )}
                </div>
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className={`bg-card border border-t-0 border-l-4 ${isFinal ? "border-l-green-500" : "border-l-transparent"} rounded-b-xl overflow-hidden`}>
                {isExpanded && (gh.rosterOut.length > 0 || gh.rosterRisk.length > 0) && (
                  <MatchupHealthStrip
                    gh={gh}
                    isFinal={isFinal}
                    onPlayerClick={setSelectedPlayerId}
                  />
                )}
                {isExpanded && isFinal && (
                  <GameBoxScore
                    gameId={g.game_id}
                    awayTeam={g.away_team}
                    homeTeam={g.home_team}
                    recapUrl={g.game_recap_url}
                    youtubeRecapId={g.youtube_recap_id}
                    onPlayerClick={setSelectedPlayerId}
                    onOpenModal={() => openGameModal(g)}
                  />
                )}
                {isExpanded && isScheduled && (
                  <UpcomingGamePreview awayTeam={g.away_team} homeTeam={g.home_team} onGameClick={setSelectedLast5Game} onTeamClick={setSelectedTeamTricode} />
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      <PlayerModal
        playerId={selectedPlayerId}
        open={selectedPlayerId !== null}
        onOpenChange={(open) => !open && setSelectedPlayerId(null)}
      />

      <TeamModal
        tricode={selectedTeamTricode}
        open={selectedTeamTricode !== null}
        onOpenChange={(open) => !open && setSelectedTeamTricode(null)}
      />

      <GameDetailDialog
        game={selectedLast5Game}
        open={selectedLast5Game !== null}
        onOpenChange={(open) => !open && setSelectedLast5Game(null)}
      />
      <TeamCompareModal
        teamA={comparePair?.a ?? null}
        teamB={comparePair?.b ?? null}
        open={comparePair !== null}
        onOpenChange={(open) => !open && setComparePair(null)}
      />
      <InjuryReportModal
        open={injuryPair !== null}
        onOpenChange={(open) => !open && setInjuryPair(null)}
        initialTeams={injuryPair ? [injuryPair.a, injuryPair.b] : undefined}
      />
      <GameDetailModal
        game={modalGame}
        open={modalGame !== null}
        onOpenChange={(o) => !o && setModalGame(null)}
      />
    </div>
  );
}
