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
import { Clapperboard, Film, ChevronLeft, ChevronRight, Tv2, ExternalLink, Crown, Flame, DollarSign, Activity } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueDeadlines } from "@/hooks/useLeagueDeadlines";
import { useLeagueTeams } from "@/hooks/useLeagueTeams";
import { useScheduleWeekGames, type ScheduleWeekGame } from "@/hooks/useScheduleWeekGames";
import { useGameBoxscoreQuery } from "@/hooks/useGameBoxscoreQuery";
import { getLeagueLogo } from "@/lib/competitions";
import { getVenue } from "@/lib/nba-venues";
import { format, parse } from "date-fns";
import { toYouTubeEmbed } from "@/lib/youtube-embed";
import GameBoxScoreTable from "@/components/game/GameBoxScoreTable";
import { cn } from "@/lib/utils";

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

  const venue = selectedGame ? getVenue(selectedGame.home_team) : null;

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

          {/* Selector bar — inline labels */}
          <div className="relative z-10 px-6 py-2.5 border-b border-amber-400/10 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground shrink-0">
                Gameday{selectedDateLabel ? <span className="text-foreground/70 normal-case tracking-normal"> · {selectedDateLabel}</span> : null}
              </label>
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
                  <SelectTrigger className="rounded-lg h-9 w-[110px]"><SelectValue placeholder="GW" /></SelectTrigger>
                  <SelectContent className="rounded-lg max-h-[320px]">
                    {allGws.map((g) => (<SelectItem key={g} value={String(g)}>GW {g}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Select value={String(day)} onValueChange={(v) => { setDay(Number(v)); setSelectedGameId(null); }}>
                  <SelectTrigger className="rounded-lg h-9 w-[110px]"><SelectValue placeholder="Day" /></SelectTrigger>
                  <SelectContent className="rounded-lg max-h-[320px]">
                    {daysList.map((d) => (<SelectItem key={d} value={String(d)}>Day {d}</SelectItem>))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-9 w-7 rounded-md shrink-0 px-0 text-muted-foreground hover:text-foreground" onClick={() => shiftDay(1)} disabled={!canNext} aria-label="Next gameday">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-400/30 bg-emerald-400/5 font-heading font-bold text-[11px] uppercase tracking-wider">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                {playedGames.length} recap{playedGames.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[10px] font-heading uppercase tracking-wider text-muted-foreground shrink-0">Game</label>
              <div className="w-2/3">
                <Select value={selectedGameId ?? ""} onValueChange={(v) => setSelectedGameId(v || null)} disabled={playedGames.length === 0}>
                  <SelectTrigger className="rounded-lg h-9">
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
            </div>
          </div>

          {/* Body with venue background */}
          <div className="relative z-10 flex-1 min-h-0 overflow-hidden">
            {venue?.image && (
              <>
                <img src={venue.image} alt="" aria-hidden className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-25" />
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/80 backdrop-blur-[2px]" />
              </>
            )}

            <div className="relative h-full w-full px-5 py-4 flex flex-col gap-3 overflow-hidden">
              {!selectedGame ? (
                <EmptyState
                  hasPlayed={playedGames.length > 0}
                  count={playedGames.length}
                  dateLabel={selectedDateLabel}
                />
              ) : (
                <>
                  {/* 3-column row: away table | video | home table */}
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] gap-3 min-h-0 flex-1">
                    <div className="rounded-xl border border-border/50 bg-background/70 backdrop-blur-sm overflow-hidden min-h-0">
                      <GameBoxScoreTable
                        game={{ game_id: selectedGame.game_id, home_team: selectedGame.home_team, away_team: selectedGame.away_team }}
                        filterTeam={selectedGame.away_team}
                        setFilterTeam={() => {}}
                        density="compact"
                        fillHeight
                      />
                    </div>

                    <div className="flex items-center justify-center min-h-0">
                      <div className="relative w-full rounded-2xl overflow-hidden border border-amber-400/30 bg-black shadow-[0_0_32px_-12px_hsl(var(--primary)/0.5)] aspect-video max-h-full">
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

                    <div className="rounded-xl border border-border/50 bg-background/70 backdrop-blur-sm overflow-hidden min-h-0">
                      <GameBoxScoreTable
                        game={{ game_id: selectedGame.game_id, home_team: selectedGame.home_team, away_team: selectedGame.away_team }}
                        filterTeam={selectedGame.home_team}
                        setFilterTeam={() => {}}
                        density="compact"
                        fillHeight
                      />
                    </div>
                  </div>

                  {/* Ballers.IQ horizontal rail */}
                  <BallersIQRail
                    gameId={selectedGame.game_id}
                    homeTeam={selectedGame.home_team}
                    awayTeam={selectedGame.away_team}
                    homePts={selectedGame.home_pts ?? 0}
                    awayPts={selectedGame.away_pts ?? 0}
                  />
                </>
              )}
            </div>
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
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <div className="relative w-full max-w-3xl rounded-2xl overflow-hidden border border-amber-400/25 bg-gradient-to-br from-black via-zinc-950 to-black aspect-video">
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
          <div className="relative h-full w-full flex flex-col items-center justify-center gap-3 px-8 text-center">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400/25 to-transparent border border-amber-400/40 flex items-center justify-center shadow-[0_0_32px_-8px_hsl(45_90%_55%/0.5)]">
              <Clapperboard className="h-7 w-7 text-amber-300" />
            </div>
            <h3 className="font-heading font-black text-base md:text-lg uppercase tracking-wider bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 bg-clip-text text-transparent">
              {hasPlayed ? "Select a game to watch the recap" : "No recaps available"}
            </h3>
            <p className="text-xs md:text-sm text-muted-foreground max-w-md">
              {hasPlayed
                ? `${count} recap${count === 1 ? "" : "s"} available${dateLabel ? ` for ${dateLabel}` : ""}. Pick a matchup from the Game dropdown above to load the video, both team box scores and Ballers.IQ insights.`
                : `No played-game recaps were found${dateLabel ? ` for ${dateLabel}` : ""}. Choose another day or gameweek to browse available recaps.`}
            </p>
      </div>
    </div>
    </div>
  );
}

// ===== Ballers.IQ horizontal rail =====

const TONE: Record<string, string> = {
  amber: "border-amber-400/45 bg-amber-400/10 text-amber-200",
  sky: "border-sky-400/45 bg-sky-400/10 text-sky-200",
  rose: "border-rose-400/45 bg-rose-400/10 text-rose-200",
  emerald: "border-emerald-400/45 bg-emerald-400/10 text-emerald-200",
  violet: "border-violet-400/45 bg-violet-400/10 text-violet-200",
};

const num = (v: unknown, d = 0) => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : d;
};

function BallersIQRail({ gameId, homePts, awayPts }: { gameId: string; homeTeam: string; awayTeam: string; homePts: number; awayPts: number }) {
  const { data } = useGameBoxscoreQuery(gameId);
  const players = (data?.players ?? []) as any[];

  const intel = useMemo(() => {
    if (!players.length) return null;
    const sorted = [...players].sort((a, b) => num(b.fp) - num(a.fp));
    const mvp = sorted[0];
    const top5 = sorted.slice(0, 5);
    const valueAce = [...players].filter((p) => num(p.salary) > 0 && num(p.fp) > 0).sort((a, b) => num(b.fp) / num(b.salary, 1) - num(a.fp) / num(a.salary, 1))[0];
    const totalPts = homePts + awayPts;
    const chips: { label: string; tone: keyof typeof TONE }[] = [];
    if (totalPts >= 230) chips.push({ label: "HIGH FP GAME", tone: "amber" });
    if (totalPts > 0 && totalPts <= 180) chips.push({ label: "LOW SCORING", tone: "sky" });
    if (Math.abs(homePts - awayPts) <= 4 && totalPts > 0) chips.push({ label: "CLOSE GAME", tone: "rose" });
    if (Math.abs(homePts - awayPts) >= 20) chips.push({ label: "BLOWOUT", tone: "emerald" });
    if (num(mvp?.fp) >= 45) chips.push({ label: "MVP SHOWING", tone: "amber" });
    return { mvp, top5, valueAce, chips };
  }, [players, homePts, awayPts]);

  if (!intel) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
      <Card icon={<Crown className="h-3 w-3 text-violet-300" />} title="MVP" tone="violet">
        {intel.mvp && (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-bold text-white truncate">{intel.mvp.name}</span>
            <span className="font-mono font-black text-amber-200 tabular-nums text-sm">{num(intel.mvp.fp).toFixed(1)}<span className="text-[9px] font-heading uppercase tracking-wider text-white/50 ml-1">FP</span></span>
          </div>
        )}
      </Card>
      <Card icon={<Flame className="h-3 w-3 text-amber-300" />} title="Top Performers" tone="amber">
        <ul className="space-y-0.5">
          {intel.top5.map((p, i) => (
            <li key={p.player_id} className="flex items-center gap-1.5 text-[10.5px]">
              <span className={cn("font-mono w-3 text-[9.5px]", i === 0 ? "text-amber-300" : "text-white/40")}>{i + 1}</span>
              <span className="truncate font-medium text-white/90 flex-1 min-w-0">{p.name}</span>
              <span className="font-mono font-bold tabular-nums text-amber-200 text-[10.5px]">{num(p.fp).toFixed(1)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card icon={<DollarSign className="h-3 w-3 text-emerald-300" />} title="Value Ace" tone="emerald">
        {intel.valueAce ? (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-bold text-white truncate">{intel.valueAce.name}</span>
            <span className="font-mono font-black text-emerald-200 tabular-nums text-sm">{(num(intel.valueAce.fp) / num(intel.valueAce.salary, 1)).toFixed(1)}<span className="text-[9px] font-heading uppercase tracking-wider text-white/50 ml-1">V</span></span>
          </div>
        ) : <span className="text-[11px] text-white/50">No data</span>}
      </Card>
      <Card icon={<Activity className="h-3 w-3 text-sky-300" />} title="Game Pulse" tone="sky">
        {intel.chips.length ? (
          <div className="flex flex-wrap gap-1">
            {intel.chips.map((c) => (
              <span key={c.label} className={cn("px-1.5 py-0.5 rounded-md border text-[9px] font-heading font-bold tracking-[0.14em]", TONE[c.tone])}>{c.label}</span>
            ))}
          </div>
        ) : <span className="text-[11px] text-white/50">Standard game flow</span>}
      </Card>
    </div>
  );
}

function Card({ icon, title, tone, children }: { icon: React.ReactNode; title: string; tone: keyof typeof TONE; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border bg-black/55 backdrop-blur-sm px-3 py-2 min-h-[64px]", TONE[tone])}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[9px] font-heading uppercase tracking-[0.22em] text-white/80">{title}</span>
      </div>
      <div className="text-white/90">{children}</div>
    </div>
  );
}