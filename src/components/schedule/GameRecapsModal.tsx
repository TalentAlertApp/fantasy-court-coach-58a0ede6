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
import { getVenue } from "@/lib/nba-venues";
import { getTeamByTricode } from "@/lib/nba-teams";
import { format, parse } from "date-fns";
import { toYouTubeEmbed } from "@/lib/youtube-embed";
import GameBoxScoreTable from "@/components/game/GameBoxScoreTable";
import GameBallersIQSidePanel from "@/components/game/GameBallersIQSidePanel";
import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import courtBg from "@/assets/court-bg.png";
import GameTeamsFormRail from "@/components/schedule/GameTeamsFormRail";
import GameActionLinks from "@/components/game/GameActionLinks";
import GameDetailModal, { type GameDetailGame } from "@/components/GameDetailModal";
import type { TeamGameSlot } from "@/hooks/useTeamRecentUpcoming";

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
  const [scheduledDetail, setScheduledDetail] = useState<GameDetailGame | null>(null);

  useEffect(() => {
    if (open) {
      setGw(initialGw);
      setDay(initialDay);
      setSelectedGameId(null);
      setBiqOn(false);
      setScheduledDetail(null);
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

  const venue = selectedGame ? getVenue(selectedGame.home_team) : null;

  // Reference timestamp for "past/next" rail: prefer the selected game's tipoff,
  // else the selected gameday deadline, else now.
  const referenceIso = useMemo(() => {
    if (selectedGame?.tipoff_utc) return selectedGame.tipoff_utc;
    const dl = deadlines.find((d) => d.gw === gw && d.day === day);
    if (dl?.deadline_utc) return dl.deadline_utc;
    return new Date().toISOString();
  }, [selectedGame, deadlines, gw, day]);

  const handleSelectPlayed = (gameId: string) => {
    const inDay = playedGames.find((g) => g.game_id === gameId);
    if (inDay) {
      setSelectedGameId(gameId);
      return;
    }
    const inWeek = weekGames.find((g) => g.game_id === gameId && isPlayedStatus(g.status));
    if (inWeek) {
      setDay(inWeek.day);
      setSelectedGameId(gameId);
    }
  };

  const handleSelectScheduled = (slot: TeamGameSlot) => {
    setScheduledDetail({
      game_id: slot.gameId,
      home_team: slot.homeTeam,
      away_team: slot.awayTeam,
      home_pts: 0,
      away_pts: 0,
      status: slot.status ?? null,
      tipoff_utc: slot.tipoffUtc,
      played: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[96vw] w-[96vw] h-[92vh] p-0 overflow-hidden border-amber-400/25 bg-background [&>button]:!text-white [&>button]:!opacity-90 [&>button]:hover:!opacity-100 [&>button]:z-50">
        <DialogHeader className="sr-only">
          <DialogTitle>Game Recaps</DialogTitle>
        </DialogHeader>

        {/* Modal background: amber radial fallback */}
        <div className="relative flex h-full flex-col overflow-hidden text-foreground bg-[radial-gradient(ellipse_at_top,hsl(30_55%_24%/0.65),hsl(25_42%_15%)_72%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(252,211,77,0.10),transparent_60%),rgba(0,0,0,0.7)] backdrop-blur-md">
          {/* Full-modal venue background (below header), fades in on select */}
          {venue?.image && (
            <>
              <img
                src={venue.image}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-80 transition-opacity duration-500"
              />
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-black/15 to-black/45" />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ backgroundImage: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4))" }}
              />
            </>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent shadow-[0_0_10px_rgba(252,211,77,0.4)]" />

          {/* Large premium league watermark */}
          <img
            src={getLeagueLogo(league)}
            alt=""
            aria-hidden
            className="pointer-events-none select-none absolute -top-6 -right-8 h-44 w-44 object-contain opacity-[0.12] rotate-[8deg] drop-shadow-[0_8px_24px_rgba(0,0,0,0.4)] z-[5]"
            style={{ WebkitMaskImage: "radial-gradient(circle at center, black 55%, transparent 78%)", maskImage: "radial-gradient(circle at center, black 55%, transparent 78%)" }}
          />

          {/* Top hero */}
          <div className="relative z-10 px-6 pt-5 pb-3 border-b border-amber-400/15">
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
          </div>

          {/* Selector bar — single row */}
          <div className="relative z-10 px-6 py-2.5 border-b border-amber-400/10">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="h-9 inline-flex items-center px-3 rounded-lg border border-amber-300/40 dark:border-amber-400/15 bg-stone-900/85 dark:bg-background/40 text-white text-[11px] font-heading uppercase tracking-[0.18em] shrink-0">
                Gameday{selectedDateLabel ? <span className="ml-1.5 text-white/85 normal-case tracking-normal font-sans"> · {selectedDateLabel}</span> : null}
              </div>
              <div className="flex items-stretch gap-1">
                <Button variant="ghost" size="icon" className="h-9 w-7 rounded-md shrink-0 px-0 text-muted-foreground hover:text-foreground" onClick={() => shiftDay(-1)} disabled={!canPrev} aria-label="Previous gameday">
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
                  <SelectTrigger className="rounded-lg h-9 w-[92px] text-[11px] font-heading uppercase tracking-[0.18em] bg-stone-900/85 dark:bg-background/40 text-white dark:text-foreground border-amber-300/40 dark:border-amber-400/15"><SelectValue placeholder="GW" /></SelectTrigger>
                  <SelectContent className="rounded-lg max-h-[320px]">
                    {allGws.map((g) => (<SelectItem key={g} value={String(g)}>GW {g}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={String(day)} onValueChange={(v) => { setDay(Number(v)); setSelectedGameId(null); }}>
                  <SelectTrigger className="rounded-lg h-9 w-[92px] text-[11px] font-heading uppercase tracking-[0.18em] bg-stone-900/85 dark:bg-background/40 text-white dark:text-foreground border-amber-300/40 dark:border-amber-400/15"><SelectValue placeholder="Day" /></SelectTrigger>
                  <SelectContent className="rounded-lg max-h-[320px]">
                    {daysList.map((d) => (<SelectItem key={d} value={String(d)}>Day {d}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-9 w-7 rounded-md shrink-0 px-0 text-muted-foreground hover:text-foreground" onClick={() => shiftDay(1)} disabled={!canNext} aria-label="Next gameday">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="h-9 inline-flex items-center px-3 rounded-lg border border-amber-300/40 dark:border-amber-400/15 bg-stone-900/85 dark:bg-background/40 text-white text-[11px] font-heading uppercase tracking-[0.18em] shrink-0 ml-1">
                Game
              </div>
              <div className="w-[clamp(320px,42%,560px)]">
                <Select value={selectedGameId ?? ""} onValueChange={(v) => setSelectedGameId(v || null)} disabled={playedGames.length === 0}>
                  <SelectTrigger className="rounded-lg h-9 text-[11px] bg-stone-900/85 dark:bg-background/40 text-white dark:text-foreground border-amber-300/40 dark:border-amber-400/15">
                    <SelectValue placeholder={playedGames.length ? `Pick a game · ${selectedDateLabel || "this gameday"}` : "No recaps available on this gameday"} />
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
                            <span className="ml-auto font-mono tabular-nums text-[11px] text-muted-foreground pl-3">{g.away_pts}-{g.home_pts}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <BallersIQButton
                  on={biqOn}
                  disabled={!selectedGame}
                  onClick={() => setBiqOn((v) => !v)}
                />
                <span className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg border border-emerald-400/30 bg-emerald-400/5 text-white font-heading font-bold text-[11px] uppercase tracking-[0.18em]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  {playedGames.length} recap{playedGames.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="relative z-10 flex-1 min-h-0 overflow-hidden">
            <div className="relative h-full w-full px-5 py-4 flex flex-col gap-3 overflow-hidden">
              <div className="flex-1 min-h-0 flex items-center justify-center">
                {!selectedGame ? (
                  <EmptyState
                    hasPlayed={playedGames.length > 0}
                    count={playedGames.length}
                    dateLabel={selectedDateLabel}
                  />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,2fr)_minmax(0,0.85fr)] gap-3 w-full transition-all duration-300 ease-out">
                  {/* LEFT: away table OR BIQ recap panel */}
                  <div className="rounded-xl border border-amber-400/30 bg-background/95 dark:bg-background/70 backdrop-blur-sm overflow-hidden animate-in fade-in duration-300 self-stretch">
                    {biqOn ? (
                      <GameBallersIQSidePanel
                        side="left"
                        gameId={selectedGame.game_id}
                        homeTeam={selectedGame.home_team}
                        awayTeam={selectedGame.away_team}
                        homePts={selectedGame.home_pts ?? 0}
                        awayPts={selectedGame.away_pts ?? 0}
                      />
                    ) : (
                      <GameBoxScoreTable
                        game={{ game_id: selectedGame.game_id, home_team: selectedGame.home_team, away_team: selectedGame.away_team }}
                        filterTeam={selectedGame.away_team}
                        setFilterTeam={() => {}}
                        density="compact"
                        fillHeight
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-center">
                      <div className="relative w-full rounded-2xl overflow-hidden border border-amber-400/30 bg-black shadow-[0_0_32px_-12px_hsl(var(--primary)/0.5)] aspect-video">
                        {embedSrc ? (
                          <iframe
                            key={selectedGame.game_id}
                            src={embedSrc}
                            title={`Recap · ${nameFor(selectedGame.away_team)} @ ${nameFor(selectedGame.home_team)}`}
                            className="absolute inset-0 w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                            allowFullScreen
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
                            <Tv2 className="h-8 w-8 text-amber-300/60" />
                            <div className="font-heading font-black uppercase tracking-wider text-xs">Recap video not yet available</div>
                            {selectedGame.game_recap_url && (
                              <a href={selectedGame.game_recap_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300 hover:text-emerald-200 px-2 py-0.5 rounded-lg border border-emerald-400/40">
                                Open external recap <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                  {/* RIGHT: home table OR BIQ market panel */}
                  <div className="rounded-xl border border-amber-400/30 bg-background/95 dark:bg-background/70 backdrop-blur-sm overflow-hidden animate-in fade-in duration-300 self-stretch">
                    {biqOn ? (
                      <GameBallersIQSidePanel
                        side="right"
                        gameId={selectedGame.game_id}
                        homeTeam={selectedGame.home_team}
                        awayTeam={selectedGame.away_team}
                        homePts={selectedGame.home_pts ?? 0}
                        awayPts={selectedGame.away_pts ?? 0}
                      />
                    ) : (
                      <GameBoxScoreTable
                        game={{ game_id: selectedGame.game_id, home_team: selectedGame.home_team, away_team: selectedGame.away_team }}
                        filterTeam={selectedGame.home_team}
                        setFilterTeam={() => {}}
                        density="compact"
                        fillHeight
                      />
                    )}
                  </div>
                  </div>
                )}
              </div>

              {/* Past 2 + Next 2 rail — always mounted */}
              <GameTeamsFormRail
                awayTeam={selectedGame?.away_team ?? null}
                homeTeam={selectedGame?.home_team ?? null}
                awayName={selectedGame ? nameFor(selectedGame.away_team) : ""}
                homeName={selectedGame ? nameFor(selectedGame.home_team) : ""}
                referenceIso={referenceIso}
                onSelectPlayedGame={handleSelectPlayed}
                onSelectScheduledGame={handleSelectScheduled}
                actions={
                  selectedGame ? (
                    <GameActionLinks
                      league={league}
                      boxscoreUrl={selectedGame.game_boxscore_url}
                      chartsUrl={selectedGame.game_charts_url}
                      playByPlayUrl={selectedGame.game_playbyplay_url}
                      leagueGameUrl={selectedGame.nba_game_url}
                      className="flex items-center gap-1.5 flex-wrap"
                    />
                  ) : undefined
                }
              />
            </div>
          </div>
        </div>
        <GameDetailModal
          game={scheduledDetail}
          open={!!scheduledDetail}
          onOpenChange={(o) => { if (!o) setScheduledDetail(null); }}
        />
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
    <div className="flex items-center justify-center w-full">
      <div
        className="recap-empty-court-light relative w-full max-w-3xl rounded-[28px] overflow-hidden border border-amber-400/25 ring-1 ring-amber-400/15 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.7)] aspect-[16/10] dark:bg-black"
        style={{
          backgroundImage: `url(${courtBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Darken the court (more in light theme so it feels involving) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[hsl(28_55%_18%/0.55)] dark:bg-black/70" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 50% 35%, hsl(45 90% 55% / 0.28), transparent 65%)",
          }}
        />
        {/* Soft inner edge fade */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[28px]"
          style={{
            boxShadow: "inset 0 0 60px 20px rgba(0,0,0,0.45)",
          }}
        />
        <div className="relative h-full w-full flex flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400/25 to-transparent border border-amber-400/40 flex items-center justify-center shadow-[0_0_32px_-8px_hsl(45_90%_55%/0.55)]">
            <Clapperboard className="h-7 w-7 text-amber-300" />
          </div>
          <h3 className="font-heading font-black text-base md:text-lg uppercase tracking-wider bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">
            {hasPlayed ? "Court is set — pick a game to tip off" : "No recaps available"}
          </h3>
          <p className="text-xs md:text-sm text-white/75 max-w-md">
            {hasPlayed
              ? `${count} recap${count === 1 ? "" : "s"} available${dateLabel ? ` for ${dateLabel}` : ""}. Pick a matchup from the Game dropdown above to load the video, both team box scores and Ballers.IQ insights.`
              : `No played-game recaps were found${dateLabel ? ` for ${dateLabel}` : ""}. Choose another day or gameweek to browse available recaps.`}
          </p>
        </div>
      </div>
    </div>
  );
}

function BallersIQButton({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      title={on ? "Disable Ballers.IQ Live" : "Activate Ballers.IQ Live"}
      className={`h-9 inline-flex items-center gap-1.5 text-[11px] font-heading uppercase tracking-[0.18em] px-3 rounded-lg border transition-all hover:scale-[1.03] disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed ${
        on
          ? "border-amber-300/70 bg-gradient-to-r from-amber-400/30 to-amber-500/15 text-white shadow-[0_0_18px_-4px_rgba(252,211,77,0.7)]"
          : "border-amber-300/40 bg-stone-900/85 dark:bg-background/40 text-white hover:border-amber-300/70 hover:bg-amber-400/10"
      }`}
    >
      <Sparkles className="h-3.5 w-3.5" />
      <BallersIQBrand variant="wordmark" size="sm" transparent className="!h-3.5 w-auto" />
      {on && (
        <span className="relative flex h-2 w-2 ml-0.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-60 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-300" />
        </span>
      )}
    </button>
  );
}