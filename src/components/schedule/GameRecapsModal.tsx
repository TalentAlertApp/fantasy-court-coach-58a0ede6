import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Clapperboard, Film, ChevronLeft, ChevronRight, Tv2, ExternalLink, Sparkles } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueDeadlines } from "@/hooks/useLeagueDeadlines";
import { useLeagueTeams } from "@/hooks/useLeagueTeams";
import { useScheduleWeekGames, type ScheduleWeekGame } from "@/hooks/useScheduleWeekGames";
import { getLeagueLogo } from "@/lib/competitions";
import { format, parse } from "date-fns";
import { toYouTubeEmbed } from "@/lib/youtube-embed";
import GameMatchupHeader from "@/components/game/GameMatchupHeader";
import GameBoxScoreTable from "@/components/game/GameBoxScoreTable";
import GameBallersIQSidePanel from "@/components/game/GameBallersIQSidePanel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialGw: number;
  initialDay: number;
}

function isPlayedStatus(s: string | null | undefined): boolean {
  return !!s && s.toUpperCase().includes("FINAL");
}

export default function GameRecapsModal({ open, onOpenChange, initialGw, initialDay }: Props) {
  const { league } = useLeague();
  const { deadlines } = useLeagueDeadlines();
  const { teams: leagueTeams } = useLeagueTeams();
  const logoFor = (tri: string) => leagueTeams.find((t) => t.tricode === tri)?.logo;
  const nameFor = (tri: string) => leagueTeams.find((t) => t.tricode === tri)?.name ?? tri;

  const [gw, setGw] = useState(initialGw);
  const [day, setDay] = useState(initialDay);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [biqOn, setBiqOn] = useState(false);

  useEffect(() => {
    if (open) {
      setGw(initialGw);
      setDay(initialDay);
      setSelectedGameId(null);
    }
  }, [open, initialGw, initialDay]);

  const allGws = useMemo(
    () => Array.from(new Set(deadlines.map((d) => d.gw))).sort((a, b) => a - b),
    [deadlines],
  );
  const daysForGw = useMemo(
    () =>
      deadlines
        .filter((d) => d.gw === gw)
        .map((d) => {
          const authored = (d as unknown as { date?: string }).date;
          const dateStr = authored ?? new Date(d.deadline_utc).toISOString().slice(0, 10);
          return { day: d.day, date: dateStr };
        }),
    [deadlines, gw],
  );
  const daysList = useMemo(() => daysForGw.map((d) => d.day), [daysForGw]);

  // flat sequence for chevron navigation
  const sequence = useMemo(
    () =>
      allGws.flatMap((g) =>
        deadlines.filter((d) => d.gw === g).map((d) => ({ gw: g, day: d.day })),
      ),
    [deadlines, allGws],
  );
  const seqIdx = useMemo(
    () => sequence.findIndex((s) => s.gw === gw && s.day === day),
    [sequence, gw, day],
  );
  const canPrev = seqIdx > 0;
  const canNext = seqIdx >= 0 && seqIdx < sequence.length - 1;
  const shiftDay = (dir: -1 | 1) => {
    if (seqIdx < 0) return;
    const next = sequence[seqIdx + dir];
    if (!next) return;
    setGw(next.gw);
    setDay(next.day);
    setSelectedGameId(null);
  };

  const { data: weekGames = [] } = useScheduleWeekGames(gw);
  const dayGames = useMemo<ScheduleWeekGame[]>(
    () => weekGames.filter((g) => g.day === day),
    [weekGames, day],
  );
  const playedGames = useMemo(
    () => dayGames.filter((g) => isPlayedStatus(g.status)),
    [dayGames],
  );

  const selectedGame = useMemo(
    () => playedGames.find((g) => g.game_id === selectedGameId) ?? null,
    [playedGames, selectedGameId],
  );

  const selectedDateLabel = useMemo(() => {
    const found = daysForGw.find((d) => d.day === day);
    if (!found?.date) return "";
    try {
      return format(parse(found.date, "yyyy-MM-dd", new Date()), "EEE, MMM d");
    } catch {
      return "";
    }
  }, [daysForGw, day]);

  const embedSrc = useMemo(
    () => toYouTubeEmbed(selectedGame?.game_recap_url ?? null, selectedGame?.youtube_recap_id ?? null),
    [selectedGame],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[96vw] w-[96vw] h-[92vh] p-0 overflow-hidden border-amber-400/25 bg-background">
        <DialogHeader className="sr-only">
          <DialogTitle>Game Recaps</DialogTitle>
        </DialogHeader>

        {/* Ballers.IQ signature background */}
        <div className="relative flex h-full flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top,rgba(252,211,77,0.10),transparent_60%)] bg-black/70 backdrop-blur-md">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent shadow-[0_0_10px_rgba(252,211,77,0.4)]" />

          {/* Top hero */}
          <div className="relative z-10 px-6 pt-5 pb-3 border-b border-amber-400/15">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400/30 to-amber-600/10 border border-amber-400/30 flex items-center justify-center shadow-[0_0_24px_-4px_hsl(var(--primary)/0.4)]">
                  <Film className="h-5 w-5 text-amber-300" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.32em] text-amber-300/80 font-heading">
                    Premium Recap Theater
                  </div>
                  <h2 className="font-heading font-black text-xl md:text-2xl uppercase tracking-wide bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">
                    Game Recaps
                  </h2>
                </div>
              </div>
              <img
                src={getLeagueLogo(league)}
                alt=""
                aria-hidden
                className="h-10 w-10 object-contain opacity-80"
              />
            </div>
          </div>

          {/* Selector bar — Gameday (GW + Day) + Game dropdown */}
          <div className="relative z-10 px-6 py-3 border-b border-amber-400/10">
            <div className="grid sm:grid-cols-[minmax(0,360px)_minmax(0,1fr)_auto] gap-3 items-end">
              <div className="space-y-1.5">
                <label className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
                  Gameday{selectedDateLabel ? <span className="text-foreground/70 normal-case tracking-normal"> · {selectedDateLabel}</span> : null}
                </label>
                <div className="flex items-stretch gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-7 rounded-md shrink-0 px-0 text-muted-foreground hover:text-foreground"
                    onClick={() => shiftDay(-1)}
                    disabled={!canPrev}
                    aria-label="Previous gameday"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Select
                    value={String(gw)}
                    onValueChange={(v) => {
                      const newGw = Number(v);
                      setGw(newGw);
                      const days = deadlines.filter((d) => d.gw === newGw).map((d) => d.day);
                      if (!days.includes(day)) setDay(days[0] ?? 1);
                      setSelectedGameId(null);
                    }}
                  >
                    <SelectTrigger className="rounded-lg flex-1 min-w-0 h-10">
                      <SelectValue placeholder="GW" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg max-h-[320px]">
                      {allGws.map((g) => (
                        <SelectItem key={g} value={String(g)}>
                          GW {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={String(day)}
                    onValueChange={(v) => {
                      setDay(Number(v));
                      setSelectedGameId(null);
                    }}
                  >
                    <SelectTrigger className="rounded-lg flex-1 min-w-0 h-10">
                      <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg max-h-[320px]">
                      {daysList.map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          Day {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-7 rounded-md shrink-0 px-0 text-muted-foreground hover:text-foreground"
                    onClick={() => shiftDay(1)}
                    disabled={!canNext}
                    aria-label="Next gameday"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground">
                  Game
                </label>
                <Select
                  value={selectedGameId ?? ""}
                  onValueChange={(v) => setSelectedGameId(v || null)}
                  disabled={playedGames.length === 0}
                >
                  <SelectTrigger className="rounded-lg h-10">
                    <SelectValue
                      placeholder={
                        playedGames.length
                          ? `Pick a game · ${selectedDateLabel || "this gameday"}`
                          : "No recaps available on this gameday"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg max-h-[320px]">
                    {playedGames.map((g) => {
                      const aL = logoFor(g.away_team);
                      const hL = logoFor(g.home_team);
                      return (
                        <SelectItem key={g.game_id} value={g.game_id}>
                          <div className="flex items-center gap-2 w-full">
                            {aL && <img src={aL} alt="" className="w-5 h-5 shrink-0" />}
                            <span className="font-medium">{nameFor(g.away_team)}</span>
                            <span className="text-muted-foreground mx-1">@</span>
                            {hL && <img src={hL} alt="" className="w-5 h-5 shrink-0" />}
                            <span className="font-medium">{nameFor(g.home_team)}</span>
                            <span className="ml-auto font-mono tabular-nums text-[11px] text-muted-foreground pl-3">
                              {g.away_pts}-{g.home_pts}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 pb-0.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/5 font-heading font-bold text-[11px] uppercase tracking-wider">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  {playedGames.length} recap{playedGames.length === 1 ? "" : "s"}
                </span>
                {selectedGame && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setBiqOn((v) => !v)}
                    className={`h-9 rounded-lg border ${biqOn ? "border-amber-400/60 bg-amber-400/10 text-amber-200" : "border-border/60 text-muted-foreground hover:text-foreground"}`}
                    title={biqOn ? "Hide Ballers.IQ" : "Show Ballers.IQ"}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Ballers.IQ
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-6 py-5">
            {!selectedGame ? (
              <EmptyState
                hasPlayed={playedGames.length > 0}
                count={playedGames.length}
                dateLabel={selectedDateLabel}
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] gap-5">
                <div className="flex flex-col gap-4 min-w-0">
                  {/* Video container (or inline empty when no embed) */}
                  <div className="relative w-full rounded-2xl overflow-hidden border border-amber-400/30 bg-black shadow-[0_0_32px_-12px_hsl(var(--primary)/0.5)] aspect-video">
                    {embedSrc ? (
                      <iframe
                        key={selectedGame.game_id}
                        src={embedSrc}
                        title={`Recap · ${nameFor(selectedGame.away_team)} @ ${nameFor(selectedGame.home_team)}`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                        <Tv2 className="h-10 w-10 text-amber-300/60" />
                        <div className="font-heading font-black uppercase tracking-wider text-sm">
                          Recap video not yet available
                        </div>
                        {selectedGame.game_recap_url && (
                          <a
                            href={selectedGame.game_recap_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-emerald-300 hover:text-emerald-200 px-3 py-1 rounded-lg border border-emerald-400/40"
                          >
                            Open external recap <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Scoreboard header — under the video */}
                  <GameMatchupHeader
                    game={{
                      game_id: selectedGame.game_id,
                      home_team: selectedGame.home_team,
                      away_team: selectedGame.away_team,
                      home_pts: selectedGame.home_pts ?? 0,
                      away_pts: selectedGame.away_pts ?? 0,
                      status: selectedGame.status,
                      game_boxscore_url: selectedGame.game_boxscore_url,
                      game_charts_url: selectedGame.game_charts_url,
                      game_playbyplay_url: selectedGame.game_playbyplay_url,
                      nba_game_url: selectedGame.nba_game_url,
                      gw: selectedGame.gw,
                      day: selectedGame.day,
                      tipoff_utc: selectedGame.tipoff_utc,
                    }}
                  />

                  {/* Box score — both teams, open by default */}
                  <div className="rounded-2xl border border-border/50 bg-background/60 overflow-hidden">
                    <GameBoxScoreTable
                      game={{
                        game_id: selectedGame.game_id,
                        home_team: selectedGame.home_team,
                        away_team: selectedGame.away_team,
                      }}
                    />
                  </div>
                </div>

                {/* Ballers.IQ rail */}
                <aside className="relative rounded-2xl border border-amber-400/25 overflow-hidden min-h-[420px] lg:sticky lg:top-0 lg:h-fit">
                  <GameBallersIQSidePanel
                    side="right"
                    gameId={selectedGame.game_id}
                    homeTeam={selectedGame.home_team}
                    awayTeam={selectedGame.away_team}
                    homePts={selectedGame.home_pts ?? 0}
                    awayPts={selectedGame.away_pts ?? 0}
                  />
                </aside>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({
  hasPlayed,
  count,
  dateLabel,
}: {
  hasPlayed: boolean;
  count: number;
  dateLabel: string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] gap-5">
      <div className="flex flex-col gap-4 min-w-0">
        {/* Placeholder card with the EXACT same shape as the video container */}
        <div className="relative w-full rounded-2xl overflow-hidden border border-amber-400/25 bg-gradient-to-br from-black via-zinc-950 to-black aspect-video">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "linear-gradient(hsl(45 90% 60%) 1px, transparent 1px), linear-gradient(90deg, hsl(45 90% 60%) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(ellipse at 50% 30%, hsl(45 90% 55% / 0.18), transparent 60%)",
            }}
          />
          <div className="relative h-full w-full flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-amber-400/25 to-transparent border border-amber-400/40 flex items-center justify-center shadow-[0_0_32px_-8px_hsl(45_90%_55%/0.5)]">
              <Clapperboard className="h-9 w-9 text-amber-300" />
            </div>
            <h3 className="font-heading font-black text-lg md:text-xl uppercase tracking-wider bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">
              {hasPlayed ? "Select a game to watch the recap" : "No recaps available"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {hasPlayed
                ? `${count} recap${count === 1 ? "" : "s"} available${dateLabel ? ` for ${dateLabel}` : ""}. Pick a matchup from the Game dropdown above to load the video, box score and Ballers.IQ insights.`
                : `No played-game recaps were found${dateLabel ? ` for ${dateLabel}` : ""}. Choose another day or gameweek to browse available recaps.`}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[10px] uppercase tracking-[0.22em] font-heading text-amber-300/80">
              <span className="px-2 py-1 rounded-md border border-amber-400/30 bg-amber-400/5">Video Recap</span>
              <span className="px-2 py-1 rounded-md border border-amber-400/30 bg-amber-400/5">Box Score</span>
              <span className="px-2 py-1 rounded-md border border-amber-400/30 bg-amber-400/5">Ballers.IQ</span>
            </div>
          </div>
        </div>
      </div>
      {/* Mirror rail placeholder so layout stays balanced */}
      <aside className="hidden lg:block rounded-2xl border border-amber-400/15 bg-black/30 min-h-[420px]" aria-hidden />
    </div>
  );
}