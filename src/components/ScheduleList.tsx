import { useState } from "react";
import { z } from "zod";
import { ScheduleGameSchema } from "@/lib/contracts";
import { Badge } from "@/components/ui/badge";
import { getTeamLogo } from "@/lib/nba-teams";
import { useGameBoxscoreQuery } from "@/hooks/useGameBoxscoreQuery";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ExternalLink, ArrowUp, ArrowDown, Tv2, Table2, BarChart3, Mic, Play } from "lucide-react";
import PlayerModal from "@/components/PlayerModal";
import NBAGameModal, { type NBAGameTab } from "@/components/NBAGameModal";

/* ---------- Recap Video Embed ---------- */
function RecapVideoEmbed({ youtubeVideoId, url, title = "Game recap" }: { youtubeVideoId?: string | null; url?: string | null; title?: string }) {
  // Priority: YouTube embed > NBA.com external link > unavailable
  if (youtubeVideoId) {
    return (
      <div className="overflow-hidden rounded-sm border border-border bg-black flex flex-col">
        <div className="w-full aspect-video overflow-hidden">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeVideoId}?rel=0&modestbranding=1`}
            title={title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
          />
        </div>
        {url && (
          <div className="flex items-center justify-between border-t border-border bg-background px-3 py-2">
            <span className="text-xs text-muted-foreground">YouTube recap</span>
            <a href={url} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
              Open on NBA.com
            </a>
          </div>
        )}
      </div>
    );
  }

  if (url) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-sm border border-border bg-black/80">
        <button
          onClick={() => window.open(url, "_blank")}
          className="flex flex-col items-center gap-2 group cursor-pointer"
        >
          <Play className="h-10 w-10 text-white/70 group-hover:text-white transition-colors" />
          <span className="text-[11px] font-heading uppercase text-white/70 group-hover:text-white">Watch Recap</span>
        </button>
        <a href={url} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
          Open on NBA.com
        </a>
      </div>
    );
  }

  return (
    <div className="flex aspect-video items-center justify-center rounded-sm border border-border bg-muted/30 text-sm text-muted-foreground">
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

type SortKey = "fp" | "mp" | "ps" | "ast" | "reb" | "blk" | "stl";
type SortDir = "asc" | "desc";

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "fp", label: "FP" },
  { key: "mp", label: "MP" },
  { key: "ps", label: "PS" },
  { key: "ast", label: "A" },
  { key: "reb", label: "R" },
  { key: "blk", label: "B" },
  { key: "stl", label: "S" },
];

function GameBoxScore({ gameId, recapUrl, youtubeRecapId, onPlayerClick }: { gameId: string; recapUrl?: string | null; youtubeRecapId?: string | null; onPlayerClick: (playerId: number) => void }) {
  const { data, isLoading } = useGameBoxscoreQuery(gameId);
  const [sortKey, setSortKey] = useState<SortKey>("fp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  if (isLoading) {
    return <div className="p-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>;
  }

  const players = data?.players ?? [];
  if (players.length === 0) {
    return <p className="p-3 text-sm text-muted-foreground">No player data available</p>;
  }

  const sorted = [...players].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  return (
    <div className="border-t bg-muted/20 flex">
      {/* Left: stats table */}
      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-[auto_repeat(7,40px)] gap-0 px-3 py-1.5 text-[10px] font-heading uppercase text-muted-foreground border-b bg-muted/40">
          <span className="pr-3">Player</span>
          {SORT_COLUMNS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className="text-right flex items-center justify-end gap-0.5 hover:text-foreground transition-colors cursor-pointer"
            >
              {label}
              {sortKey === key && (sortDir === "desc" ? <ArrowDown className="h-2.5 w-2.5" /> : <ArrowUp className="h-2.5 w-2.5" />)}
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
                className="grid grid-cols-[auto_repeat(7,40px)] gap-0 px-3 py-1.5 text-sm items-center border-b border-border/40 last:border-b-0 cursor-pointer hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-1.5 min-w-0">
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
                  <span className="text-xs font-medium">{p.name}</span>
                </div>
                <span className="text-right font-mono text-xs font-bold">{p.fp}</span>
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
      <div className="w-[500px] shrink-0 border-l flex flex-col p-3 bg-muted/10">
        <RecapVideoEmbed
          youtubeVideoId={youtubeRecapId}
          url={recapUrl}
          title="Game Recap"
        />
      </div>
    </div>
  );
}

/** Action icon button for game card */
function GameActionIcon({ icon: Icon, url, label, onClick }: {
  icon: typeof Tv2; url: string | null | undefined; label: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  if (!url) return null;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      className="text-muted-foreground hover:text-primary transition-colors p-0.5"
      title={label}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export default function ScheduleList({ games }: ScheduleListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [modalState, setModalState] = useState<{ open: boolean; tab: NBAGameTab; game: ScheduleGame | null }>({
    open: false, tab: "recap", game: null,
  });

  const openModal = (game: ScheduleGame, tab: NBAGameTab) => {
    setModalState({ open: true, tab, game });
  };

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
                  {/* LIVE badge */}
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
                  <GameActionIcon icon={Tv2} url={g.game_recap_url} label="Game Recap" onClick={() => openModal(g, "recap")} />
                  <GameActionIcon icon={Table2} url={g.game_boxscore_url} label="Box Score" onClick={() => openModal(g, "boxscore")} />
                  <GameActionIcon icon={BarChart3} url={g.game_charts_url} label="Charts" onClick={() => openModal(g, "charts")} />
                  <GameActionIcon icon={Mic} url={g.game_playbyplay_url} label="Play-by-Play" onClick={() => openModal(g, "playbyplay")} />
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
                {isExpanded && <GameBoxScore gameId={g.game_id} recapUrl={g.game_recap_url} youtubeRecapId={g.youtube_recap_id} onPlayerClick={setSelectedPlayerId} />}
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

      {modalState.game && (
        <NBAGameModal
          open={modalState.open}
          onOpenChange={(open) => setModalState((s) => ({ ...s, open }))}
          defaultTab={modalState.tab}
          urls={modalState.game}
          title={`${modalState.game.away_team} @ ${modalState.game.home_team}`}
        />
      )}
    </div>
  );
}
