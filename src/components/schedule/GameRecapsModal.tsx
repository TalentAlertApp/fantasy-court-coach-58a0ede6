import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clapperboard, Film, ChevronLeft, ChevronRight, PlayCircle } from "lucide-react";
import courtBg from "@/assets/court-bg.png";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueDeadlines } from "@/hooks/useLeagueDeadlines";
import { useLeagueTeams } from "@/hooks/useLeagueTeams";
import { useScheduleWeekGames, type ScheduleWeekGame } from "@/hooks/useScheduleWeekGames";
import { getLeagueLogo } from "@/lib/competitions";
import { format, parse } from "date-fns";
import GameDetailModal, { type GameDetailGame } from "@/components/GameDetailModal";

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
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setGw(initialGw);
      setDay(initialDay);
    }
  }, [open, initialGw, initialDay]);

  const maxGw = useMemo(() => deadlines.reduce((m, d) => Math.max(m, d.gw), 1), [deadlines]);
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

  const { data: weekGames = [] } = useScheduleWeekGames(gw);
  const dayGames = useMemo<ScheduleWeekGame[]>(
    () => weekGames.filter((g) => g.day === day),
    [weekGames, day],
  );
  const playedGames = useMemo(
    () => dayGames.filter((g) => isPlayedStatus(g.status)),
    [dayGames],
  );

  // Auto-select first played game when day changes
  useEffect(() => {
    if (!open) return;
    if (playedGames.length === 0) {
      setSelectedGameId(null);
      return;
    }
    if (!selectedGameId || !playedGames.some((g) => g.game_id === selectedGameId)) {
      setSelectedGameId(playedGames[0].game_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, gw, day, playedGames.length]);

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

  const handleOpenRecap = (gameId: string) => {
    setSelectedGameId(gameId);
    setDetailOpen(true);
  };

  const detailGame: GameDetailGame | null = selectedGame
    ? {
        game_id: selectedGame.game_id,
        home_team: selectedGame.home_team,
        away_team: selectedGame.away_team,
        home_pts: selectedGame.home_pts ?? 0,
        away_pts: selectedGame.away_pts ?? 0,
        status: selectedGame.status,
        game_boxscore_url: selectedGame.game_boxscore_url,
        game_charts_url: selectedGame.game_charts_url,
        game_playbyplay_url: selectedGame.game_playbyplay_url,
        game_recap_url: selectedGame.game_recap_url,
        youtube_recap_id: selectedGame.youtube_recap_id,
        nba_game_url: selectedGame.nba_game_url,
        gw: selectedGame.gw,
        day: selectedGame.day,
        tipoff_utc: selectedGame.tipoff_utc,
        played: true,
      }
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!max-w-[96vw] w-[96vw] h-[92vh] p-0 overflow-hidden border-amber-400/20 bg-background">
          <DialogHeader className="sr-only">
            <DialogTitle>Game Recaps</DialogTitle>
          </DialogHeader>

          {/* Cinematic background */}
          <div className="relative flex h-full flex-col overflow-hidden">
            <img
              src={courtBg}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.18] dark:opacity-[0.22] select-none"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-background/85 via-background/75 to-background/95" />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(ellipse at 50% 0%, hsl(var(--primary) / 0.18) 0%, transparent 55%), radial-gradient(ellipse at 50% 100%, hsl(var(--accent) / 0.12) 0%, transparent 60%)",
              }}
            />

            {/* Top hero */}
            <div className="relative z-10 px-6 pt-5 pb-3 border-b border-amber-400/15 bg-background/30 backdrop-blur-md">
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

            {/* Navigation row */}
            <div className="relative z-10 px-6 py-4 border-b border-amber-400/10 bg-background/20 backdrop-blur-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Gameweek */}
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground font-heading mb-1.5">
                    Gameweek
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => gw > 1 && setGw(gw - 1)}
                      disabled={gw <= 1}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border/60 bg-background/40 text-foreground/80 hover:bg-amber-400/10 hover:border-amber-400/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex-1 text-center px-3 py-1.5 rounded-lg border border-amber-400/30 bg-amber-400/5 font-heading font-bold text-sm">
                      GW {gw}
                    </div>
                    <button
                      onClick={() => gw < maxGw && setGw(gw + 1)}
                      disabled={gw >= maxGw}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border/60 bg-background/40 text-foreground/80 hover:bg-amber-400/10 hover:border-amber-400/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Day */}
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground font-heading mb-1.5">
                    Day {selectedDateLabel ? `· ${selectedDateLabel}` : ""}
                  </div>
                  <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                    {daysForGw.map((d, i) => {
                      const isSel = d.day === day;
                      const dn = d.date
                        ? format(parse(d.date, "yyyy-MM-dd", new Date()), "EEE")
                        : `D${d.day}`;
                      return (
                        <button
                          key={d.day}
                          onClick={() => setDay(d.day)}
                          className={`shrink-0 min-w-[64px] px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase transition-all ${
                            isSel
                              ? "bg-amber-400/15 text-amber-200 border border-amber-400/50 shadow-[0_0_12px_-4px_hsl(var(--primary)/0.5)]"
                              : "border border-border/40 bg-background/30 text-muted-foreground hover:text-foreground hover:border-amber-400/30"
                          }`}
                          title={`Day ${d.day}`}
                        >
                          {dn}
                          <span className="ml-1 opacity-60 font-mono">{i + 1}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Game count badge */}
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground font-heading mb-1.5">
                    Recaps Available
                  </div>
                  <div className="px-3 py-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/5 font-heading font-bold text-sm inline-flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 animate-ping" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    {playedGames.length} played · {dayGames.length} total
                  </div>
                </div>
              </div>
            </div>

            {/* Game grid */}
            <div className="relative z-10 flex-1 overflow-y-auto px-6 py-5">
              {playedGames.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {playedGames.map((g) => {
                    const awayLogo = logoFor(g.away_team);
                    const homeLogo = logoFor(g.home_team);
                    const hasRecap = !!(g.youtube_recap_id || g.game_recap_url);
                    return (
                      <button
                        key={g.game_id}
                        onClick={() => handleOpenRecap(g.game_id)}
                        className="group relative text-left rounded-2xl border border-amber-400/15 bg-background/60 backdrop-blur-sm p-4 transition-all hover:border-amber-400/50 hover:bg-background/80 hover:shadow-[0_0_24px_-6px_hsl(var(--primary)/0.4)] hover:scale-[1.015]"
                      >
                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          <span className="text-[9px] font-heading font-bold uppercase tracking-[0.2em] px-1.5 py-0.5 rounded border border-foreground/20 bg-background/60">
                            Final
                          </span>
                          {hasRecap && (
                            <span className="text-[9px] font-heading font-bold uppercase tracking-[0.2em] px-1.5 py-0.5 rounded border border-emerald-400/40 bg-emerald-400/10 text-emerald-300">
                              Recap
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-4">
                          <div className="flex flex-col items-center gap-1">
                            {awayLogo && <img src={awayLogo} alt="" className="h-12 w-12 object-contain" />}
                            <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-foreground/80 truncate max-w-full">
                              {nameFor(g.away_team)}
                            </span>
                            <span className="font-mono font-black text-xl tabular-nums">
                              {g.away_pts}
                            </span>
                          </div>
                          <div className="text-[10px] font-heading uppercase tracking-[0.24em] text-muted-foreground">
                            @
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            {homeLogo && <img src={homeLogo} alt="" className="h-12 w-12 object-contain" />}
                            <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-foreground/80 truncate max-w-full">
                              {nameFor(g.home_team)}
                            </span>
                            <span className="font-mono font-black text-xl tabular-nums">
                              {g.home_pts}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-center gap-1.5 text-[10px] font-heading uppercase tracking-[0.22em] text-amber-300/90 group-hover:text-amber-200 transition-colors">
                          <PlayCircle className="h-3.5 w-3.5" />
                          Open Recap
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stacked detail dialog — reuses ALL existing Game Played modal features */}
      <GameDetailModal game={detailGame} open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[320px] gap-3 text-center px-6">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400/20 to-transparent border border-amber-400/30 flex items-center justify-center">
        <Clapperboard className="h-7 w-7 text-amber-300/80" />
      </div>
      <h3 className="font-heading font-black text-lg uppercase tracking-wider">
        No Game Recaps Available
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">
        No played-game recaps were found for this selected day. Choose another day or gameweek to browse available recaps.
      </p>
    </div>
  );
}