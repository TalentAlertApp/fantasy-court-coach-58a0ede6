import { useState, useMemo } from "react";
import { z } from "zod";
import { ScheduleGameSchema } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { getTeamLogo } from "@/lib/nba-teams";
import { useGameBoxscoreQuery } from "@/hooks/useGameBoxscoreQuery";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, ExternalLink, Tv2, Table2, BarChart3, Mic } from "lucide-react";
import PlayerModal from "@/components/PlayerModal";
import TeamModal from "@/components/TeamModal";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NBA_TEAM_META } from "@/data/nbaTeamsFallback";
import { format } from "date-fns";

/* ---------- Recap Video Embed ---------- */
function RecapVideoEmbed({ youtubeVideoId, url, title = "Game recap" }: { youtubeVideoId?: string | null; url?: string | null; title?: string }) {
  if (youtubeVideoId) {
    return (
      <div className="w-full h-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${youtubeVideoId}?rel=0&modestbranding=1`}
          title={title}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  if (url) {
    return (
      <div className="flex w-full h-full flex-col items-center justify-center gap-3 rounded-xl bg-black/80">
        <a href={url} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
          Watch on NBA.com
        </a>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full items-center justify-center rounded-xl bg-muted/30 text-sm text-muted-foreground">
      Recap unavailable
    </div>
  );
}

type ScheduleGame = z.infer<typeof ScheduleGameSchema>;

interface ScheduleListProps {
  games: ScheduleGame[];
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
  if (s === "LIVE" || s === "IN_PROGRESS") return "border-l-[hsl(var(--nba-yellow))]";
  return "border-l-transparent";
}

function isGameFinal(status: string) {
  return status.toUpperCase().includes("FINAL");
}

function isGameLive(status: string) {
  const s = status.toUpperCase();
  return s === "LIVE" || s === "IN_PROGRESS";
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

function GameBoxScore({ gameId, awayTeam, homeTeam, recapUrl, youtubeRecapId, onPlayerClick }: {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  recapUrl?: string | null;
  youtubeRecapId?: string | null;
  onPlayerClick: (playerId: number) => void;
}) {
  const { data, isLoading } = useGameBoxscoreQuery(gameId);
  const [sortKey, setSortKey] = useState<SortKey>("fp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterTeam, setFilterTeam] = useState<string | null>(null);
  const [filterFcBc, setFilterFcBc] = useState<string | null>(null);

  if (isLoading) {
    return <div className="p-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>;
  }

  const players = data?.players ?? [];
  if (players.length === 0) {
    return <p className="p-3 text-sm text-muted-foreground">No player data available</p>;
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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const awayLogo = getTeamLogo(awayTeam);
  const homeLogo = getTeamLogo(homeTeam);

  return (
    <div className="border-t bg-muted/20 grid grid-cols-[1fr_auto] items-stretch">
      <div className="min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)_repeat(9,40px)] gap-0 px-3 py-2 text-xs font-heading uppercase text-muted-foreground border-b bg-muted/40" style={{ overflowY: "hidden", scrollbarGutter: "stable" }}>
          <div className="pr-3 flex items-center gap-1.5">
            <span>Player</span>
            <button
              onClick={() => setFilterTeam(filterTeam === awayTeam ? null : awayTeam)}
              className={`flex items-center gap-0.5 px-1 py-0.5 rounded-lg border text-[8px] font-bold transition-colors ${filterTeam === awayTeam ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
            >
              {awayLogo && <img src={awayLogo} alt="" className="w-3 h-3" />}
              {awayTeam}
            </button>
            <button
              onClick={() => setFilterTeam(filterTeam === homeTeam ? null : homeTeam)}
              className={`flex items-center gap-0.5 px-1 py-0.5 rounded-lg border text-[8px] font-bold transition-colors ${filterTeam === homeTeam ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
            >
              {homeLogo && <img src={homeLogo} alt="" className="w-3 h-3" />}
              {homeTeam}
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
              className={`text-right hover:text-foreground transition-colors cursor-pointer ${
                sortKey === key ? "font-bold text-foreground" : ""
              } ${highlight ? "text-red-500 font-bold" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="max-h-[360px] overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
          {sorted.map((p) => {
            const isFc = p.fc_bc === "FC";
            return (
              <div
                key={p.player_id}
                onClick={() => onPlayerClick(p.player_id)}
                className="grid grid-cols-[minmax(0,1fr)_repeat(9,40px)] gap-0 px-3 py-1.5 text-sm items-center border-b border-border/40 last:border-b-0 cursor-pointer hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-1.5 pr-3">
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
                  <span className="text-sm font-medium whitespace-nowrap">{p.name}</span>
                </div>
                <span className="text-right font-mono text-sm font-bold">{p.fp}</span>
                <span className="text-right font-mono text-sm text-red-500">{(p as any).salary ?? 0}</span>
                <span className="text-right font-mono text-sm text-red-500">{p.value.toFixed(1)}</span>
                <span className="text-right font-mono text-sm text-muted-foreground">{p.mp}</span>
                <span className="text-right font-mono text-sm">{p.ps}</span>
                <span className="text-right font-mono text-sm">{p.ast}</span>
                <span className="text-right font-mono text-sm">{p.reb}</span>
                <span className="text-right font-mono text-sm">{p.blk}</span>
                <span className="text-right font-mono text-sm">{p.stl}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="w-[640px] shrink-0 border-l aspect-video self-stretch">
        <RecapVideoEmbed
          youtubeVideoId={youtubeRecapId}
          url={recapUrl}
          title="Game Recap"
        />
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

function useTeamFormData(teams: string[], enabled: boolean) {
  return useQuery({
    queryKey: ["team-form", ...teams],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("schedule_games")
        .select("game_id, home_team, away_team, home_pts, away_pts, status, tipoff_utc, game_boxscore_url, game_charts_url, game_playbyplay_url, game_recap_url, nba_game_url, youtube_recap_id")
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

      for (const tricode of teams) {
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
    enabled,
    staleTime: 60_000,
  });
}

function GameDetailDialog({ game, open, onOpenChange }: { game: Last5Game | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [showRecap, setShowRecap] = useState(false);
  if (!game) return null;
  const awayLogo = getTeamLogo(game.away_team);
  const homeLogo = getTeamLogo(game.home_team);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-xl p-4">
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
        <div className="flex items-center justify-center gap-2 py-1">
          {game.game_boxscore_url && (
            <a href={game.game_boxscore_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-xl border" title="Box Score">
              <Table2 className="h-3.5 w-3.5" /> BoxScore
            </a>
          )}
          {game.game_charts_url && (
            <a href={game.game_charts_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-xl border" title="Charts">
              <BarChart3 className="h-3.5 w-3.5" /> Charts
            </a>
          )}
          {game.game_playbyplay_url && (
            <a href={game.game_playbyplay_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-xl border" title="Play-by-Play">
              <Mic className="h-3.5 w-3.5" /> PbP
            </a>
          )}
          {game.nba_game_url && (
            <a href={game.nba_game_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded-xl border" title="NBA.com">
              <ExternalLink className="h-3.5 w-3.5" /> NBA
            </a>
          )}
        </div>
        {game.youtube_recap_id && (
          <div>
            <button
              onClick={() => setShowRecap(!showRecap)}
              className="flex items-center gap-1 text-xs text-green-500 hover:text-green-400 transition-colors mx-auto py-1"
            >
              <Tv2 className="h-3.5 w-3.5" /> {showRecap ? "Hide" : "Watch"} Recap
            </button>
            {showRecap && (
              <div className="relative w-full mt-1" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  className="absolute inset-0 w-full h-full rounded-xl"
                  src={`https://www.youtube.com/embed/${game.youtube_recap_id}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UpcomingGamePreview({ awayTeam, homeTeam, onGameClick, onTeamClick }: {
  awayTeam: string; homeTeam: string;
  onGameClick: (game: Last5Game) => void;
  onTeamClick: (tricode: string) => void;
}) {
  const { data, isLoading } = useTeamFormData([awayTeam, homeTeam], true);

  if (isLoading) return <div className="p-3"><Skeleton className="h-16" /></div>;
  if (!data) return null;

  const away = data[awayTeam];
  const home = data[homeTeam];
  if (!away || !home) return null;

  return (
    <div className="border-t bg-muted/20 px-4 py-3">
      <div className="grid grid-cols-2 gap-4">
        {[away, home].map((team) => {
          const logo = getTeamLogo(team.tricode);
          const meta = NBA_TEAM_META[team.tricode];
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
              <div>
                <p className="text-xs font-heading font-bold text-muted-foreground uppercase mb-1">Last 5 Games</p>
                <div className="space-y-1">
                  {team.last5.map((g, i) => {
                    const oppLogo = getTeamLogo(g.opp);
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
                        <div className="flex items-center gap-0 ml-auto">
                          {g.game_boxscore_url && <a href={g.game_boxscore_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary p-0.5" title="Box Score"><Table2 className="h-3 w-3" /></a>}
                          {g.game_charts_url && <a href={g.game_charts_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary p-0.5" title="Charts"><BarChart3 className="h-3 w-3" /></a>}
                          {g.game_playbyplay_url && <a href={g.game_playbyplay_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary p-0.5" title="Play-by-Play"><Mic className="h-3 w-3" /></a>}
                          <span className={`p-0.5 ${g.youtube_recap_id ? "text-green-500" : "text-muted-foreground/30"}`} title="Recap"><Tv2 className="h-3 w-3" /></span>
                        </div>
                      </div>
                    );
                  })}
                  {team.last5.length === 0 && <span className="text-[10px] text-muted-foreground">No games played</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ScheduleList({ games }: ScheduleListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [selectedTeamTricode, setSelectedTeamTricode] = useState<string | null>(null);
  const [selectedLast5Game, setSelectedLast5Game] = useState<Last5Game | null>(null);

  if (games.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-heading uppercase">No Games Scheduled</p>
        <p className="text-sm font-body">Try navigating to a different day</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-1">
      {games.map((g) => {
        const isFinal = isGameFinal(g.status);
        const isLive = isGameLive(g.status);
        const isScheduled = !isFinal && !isLive;
        const isExpandable = isFinal || isScheduled;
        const isExpanded = expandedId === g.game_id;
        const hasYoutubeRecap = !!g.youtube_recap_id;

        return (
          <Collapsible
            key={g.game_id}
            open={isExpanded}
            onOpenChange={() => isExpandable && setExpandedId(isExpanded ? null : g.game_id)}
          >
            <CollapsibleTrigger asChild disabled={!isExpandable}>
              <div
                className={`bg-card rounded-xl border border-l-4 ${getStatusBorder(g.status)} flex items-center px-5 py-3 ${
                  isExpandable ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""
                } ${isExpanded ? "rounded-b-none border-b-0" : ""}`}
              >
                {/* Teams */}
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex items-center gap-2 min-w-[100px] justify-end text-right">
                    <div>
                      <p className="font-heading font-bold text-sm uppercase leading-tight">{g.away_team}</p>
                      {(isFinal || isLive) && (
                        <p className={`text-2xl font-mono leading-tight ${
                          isFinal && g.away_pts > g.home_pts ? "font-black" : "font-normal opacity-60"
                        }`}>{g.away_pts}</p>
                      )}
                    </div>
                    {getTeamLogo(g.away_team) && (
                      <img src={getTeamLogo(g.away_team)} alt={g.away_team} className="w-12 h-12 transition-transform hover:scale-110" />
                    )}
                  </div>

                  {/* Center: status */}
                  <div className="flex flex-col items-center min-w-[80px]">
                    <span className="text-muted-foreground text-[10px] font-heading font-bold mb-0.5">@</span>
                    {isLive ? (
                      <span className="text-sm font-heading font-black text-destructive animate-pulse">LIVE</span>
                    ) : (
                      <span className={`text-sm font-heading font-bold ${isFinal ? "text-green-600" : "text-muted-foreground"}`}>
                        {g.status}
                      </span>
                    )}
                    {g.tipoff_utc && (
                      <span className="text-xs font-mono font-bold text-muted-foreground mt-0.5">
                        {formatTipoff(g.tipoff_utc)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 min-w-[100px]">
                    {getTeamLogo(g.home_team) && (
                      <img src={getTeamLogo(g.home_team)} alt={g.home_team} className="w-12 h-12 transition-transform hover:scale-110" />
                    )}
                    <div>
                      <p className="font-heading font-bold text-sm uppercase leading-tight">{g.home_team}</p>
                      {(isFinal || isLive) && (
                        <p className={`text-2xl font-mono leading-tight ${
                          isFinal && g.home_pts > g.away_pts ? "font-black" : "font-normal opacity-60"
                        }`}>{g.home_pts}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: action icons */}
                <div className="flex items-center gap-1.5">
                  {isFinal && (
                    <span
                      onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : g.game_id); }}
                      className={`p-0.5 cursor-pointer transition-colors ${hasYoutubeRecap ? "text-green-500" : "text-muted-foreground hover:text-primary"}`}
                      title="Game Recap"
                    >
                      <Tv2 className="h-4 w-4" />
                    </span>
                  )}
                  <GameActionIcon icon={Table2} url={g.game_boxscore_url} label="Box Score" />
                  <GameActionIcon icon={BarChart3} url={g.game_charts_url} label="Charts" />
                  <GameActionIcon icon={Mic} url={g.game_playbyplay_url} label="Play-by-Play" />
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
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className={`bg-card border border-t-0 border-l-4 ${isFinal ? "border-l-green-500" : "border-l-transparent"} rounded-b-xl overflow-hidden`}>
                {isExpanded && isFinal && (
                  <GameBoxScore
                    gameId={g.game_id}
                    awayTeam={g.away_team}
                    homeTeam={g.home_team}
                    recapUrl={g.game_recap_url}
                    youtubeRecapId={g.youtube_recap_id}
                    onPlayerClick={setSelectedPlayerId}
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
    </div>
  );
}
