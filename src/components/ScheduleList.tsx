import { useState } from "react";
import { z } from "zod";
import { ScheduleGameSchema } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { getTeamLogo } from "@/lib/nba-teams";
import { useGameBoxscoreQuery } from "@/hooks/useGameBoxscoreQuery";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ExternalLink, Tv2, Table2, BarChart3, Mic } from "lucide-react";
import PlayerModal from "@/components/PlayerModal";

/* ---------- Recap Video Embed ---------- */
function RecapVideoEmbed({ youtubeVideoId, url, title = "Game recap" }: { youtubeVideoId?: string | null; url?: string | null; title?: string }) {
  if (youtubeVideoId) {
    return (
      <div className="w-full h-full overflow-hidden rounded-sm bg-black">
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
      <div className="flex w-full h-full flex-col items-center justify-center gap-3 rounded-sm bg-black/80">
        <a href={url} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
          Watch on NBA.com
        </a>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full items-center justify-center rounded-sm bg-muted/30 text-sm text-muted-foreground">
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
      {/* Left: stats table */}
      <div className="min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)_repeat(9,40px)] gap-0 px-3 py-1.5 text-[10px] font-heading uppercase text-muted-foreground border-b bg-muted/40">
          <div className="pr-3 flex items-center gap-1.5">
            <span>Player</span>
            {/* Team filter badges */}
            <button
              onClick={() => setFilterTeam(filterTeam === awayTeam ? null : awayTeam)}
              className={`flex items-center gap-0.5 px-1 py-0.5 rounded-sm border text-[8px] font-bold transition-colors ${filterTeam === awayTeam ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
            >
              {awayLogo && <img src={awayLogo} alt="" className="w-3 h-3" />}
              {awayTeam}
            </button>
            <button
              onClick={() => setFilterTeam(filterTeam === homeTeam ? null : homeTeam)}
              className={`flex items-center gap-0.5 px-1 py-0.5 rounded-sm border text-[8px] font-bold transition-colors ${filterTeam === homeTeam ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
            >
              {homeLogo && <img src={homeLogo} alt="" className="w-3 h-3" />}
              {homeTeam}
            </button>
            {/* FC/BC filter buttons */}
            <button
              onClick={() => setFilterFcBc(filterFcBc === "FC" ? null : "FC")}
              className={`px-1.5 py-0.5 rounded-sm border text-[8px] font-bold transition-colors ${filterFcBc === "FC" ? "bg-destructive text-destructive-foreground border-destructive" : "border-border hover:bg-muted"}`}
            >
              FC
            </button>
            <button
              onClick={() => setFilterFcBc(filterFcBc === "BC" ? null : "BC")}
              className={`px-1.5 py-0.5 rounded-sm border text-[8px] font-bold transition-colors ${filterFcBc === "BC" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
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
        <div className="max-h-[360px] overflow-y-auto">
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
                    className="text-[7px] px-0.5 py-0 shrink-0 rounded-sm font-heading min-w-[18px] justify-center"
                  >
                    {p.fc_bc}
                  </Badge>
                  <span className="text-xs font-medium whitespace-nowrap">{p.name}</span>
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
      </div>
      {/* Right: recap video */}
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

/** Action icon for direct URL links */
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
      <Icon className="h-3.5 w-3.5" />
    </a>
  );
}

export default function ScheduleList({ games }: ScheduleListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  if (games.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-heading uppercase">No Games Scheduled</p>
        <p className="text-sm font-body">Try navigating to a different day</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 px-1">
      {games.map((g) => {
        const isFinal = isGameFinal(g.status);
        const isLive = isGameLive(g.status);
        const isExpanded = expandedId === g.game_id;
        const hasYoutubeRecap = !!g.youtube_recap_id;

        return (
          <Collapsible
            key={g.game_id}
            open={isExpanded}
            onOpenChange={() => isFinal && setExpandedId(isExpanded ? null : g.game_id)}
          >
            <CollapsibleTrigger asChild disabled={!isFinal}>
              <div
                className={`bg-card rounded-sm border border-l-4 ${getStatusBorder(g.status)} flex items-center justify-between px-4 py-3 ${
                  isFinal ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""
                } ${isExpanded ? "rounded-b-none border-b-0" : ""}`}
              >
                {/* Teams */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-2.5 min-w-[110px] justify-end text-right">
                    <div>
                      <p className="font-heading font-bold text-sm uppercase leading-tight">{g.away_team}</p>
                      {(isFinal || isLive) && <p className="text-xl font-mono font-black leading-tight">{g.away_pts}</p>}
                    </div>
                    {getTeamLogo(g.away_team) && (
                      <img src={getTeamLogo(g.away_team)} alt={g.away_team} className="w-8 h-8" />
                    )}
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-muted-foreground text-[10px] font-heading font-bold">@</span>
                  </div>
                  <div className="flex items-center gap-2.5 min-w-[110px]">
                    {getTeamLogo(g.home_team) && (
                      <img src={getTeamLogo(g.home_team)} alt={g.home_team} className="w-8 h-8" />
                    )}
                    <div>
                      <p className="font-heading font-bold text-sm uppercase leading-tight">{g.home_team}</p>
                      {(isFinal || isLive) && <p className="text-xl font-mono font-black leading-tight">{g.home_pts}</p>}
                    </div>
                  </div>
                </div>

                {/* Right info */}
                <div className="flex items-center gap-1.5">
                  {isLive && (
                    <a
                      href={g.game_playbyplay_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-block"
                    >
                      <Badge className="bg-destructive text-destructive-foreground text-[9px] rounded-sm px-1.5 py-0 font-heading font-bold animate-pulse">
                        LIVE
                      </Badge>
                    </a>
                  )}
                  <Badge
                    variant={isFinal ? "secondary" : "outline"}
                    className={`text-[10px] rounded-sm font-heading ${
                      isFinal ? "bg-green-500/10 text-green-700 border-green-500/30" : ""
                    }`}
                  >
                    {g.status}
                  </Badge>
                  {g.tipoff_utc && (
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded-sm font-bold">
                      {formatTipoff(g.tipoff_utc)}
                    </span>
                  )}
                  {/* Action icons */}
                  {isFinal && (
                    <span
                      onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : g.game_id); }}
                      className={`p-0.5 cursor-pointer transition-colors ${hasYoutubeRecap ? "text-green-500" : "text-muted-foreground hover:text-primary"}`}
                      title="Game Recap"
                    >
                      <Tv2 className="h-3.5 w-3.5" />
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
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {isFinal && (
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  )}
                </div>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-card border border-t-0 border-l-4 border-l-green-500 rounded-b-sm overflow-hidden">
                {isExpanded && (
                  <GameBoxScore
                    gameId={g.game_id}
                    awayTeam={g.away_team}
                    homeTeam={g.home_team}
                    recapUrl={g.game_recap_url}
                    youtubeRecapId={g.youtube_recap_id}
                    onPlayerClick={setSelectedPlayerId}
                  />
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
    </div>
  );
}
