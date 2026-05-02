import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useScheduleQuery } from "@/hooks/useScheduleQuery";
import TeamOfTheWeekModal from "@/components/TeamOfTheWeekModal";
import { useScheduleWeekCounts } from "@/hooks/useScheduleWeekCounts";
import { useLastPlayedDay } from "@/hooks/useLastPlayedDay";
import ScheduleList from "@/components/ScheduleList";
import { TopPlayersPanel, useTopPlayersData } from "@/components/TopPlayersStrip";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, CircleCheckBig, Grid3X3, Medal, Star, RefreshCw, AlertTriangle, Rows3, LayoutGrid, Bandage } from "lucide-react";
import InjuryReportModal from "@/components/InjuryReportModal";
import { Badge } from "@/components/ui/badge";
import { format, parse } from "date-fns";
import { DEADLINES, getCurrentGameday, formatDeadline } from "@/lib/deadlines";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import BallersIQTicker from "@/components/ballers-iq/BallersIQTicker";
import BallersIQCard from "@/components/ballers-iq/BallersIQCard";
import { useRosterQuery } from "@/hooks/useRosterQuery";
import { usePlayersQuery } from "@/hooks/usePlayersQuery";
import { getBallersIQInsights } from "@/lib/ballers-iq";

const MIN_WEEK = 1;
const MAX_WEEK = 25;

function buildWeekDayToDate(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const d of DEADLINES) {
    const dt = new Date(d.deadline_utc);
    const dateStr = dt.toISOString().slice(0, 10);
    map[`${d.gw}-${d.day}`] = dateStr;
  }
  return map;
}

const WEEK_DAY_TO_DATE = buildWeekDayToDate();

function getDaysForWeek(gw: number): { day: number; date: string; dateObj: Date }[] {
  return DEADLINES
    .filter((d) => d.gw === gw)
    .map((d) => {
      const dateStr = WEEK_DAY_TO_DATE[`${d.gw}-${d.day}`] ?? "";
      return { day: d.day, date: dateStr, dateObj: new Date(dateStr) };
    });
}

function getWeekDateRange(gw: number): string {
  const days = getDaysForWeek(gw);
  if (days.length === 0) return "";
  const first = days[0].dateObj;
  const last = days[days.length - 1].dateObj;
  return `${format(first, "MMM d")} – ${format(last, "MMM d")}`;
}

export default function SchedulePage() {
  const current = useMemo(() => getCurrentGameday(), []);
  const [gw, setGw] = useState(current.gw);
  const [day, setDay] = useState(current.day);
  const [totwOpen, setTotwOpen] = useState(false);
  const [potdOpen, setPotdOpen] = useState(false);
  const [injuryOpen, setInjuryOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem("schedule_view_mode") as "list" | "grid") || "grid";
  });
  useEffect(() => {
    localStorage.setItem("schedule_view_mode", viewMode);
  }, [viewMode]);
  const navigate = useNavigate();
  const { data, isLoading, isError, isSuccess, refetch } = useScheduleQuery({ gw, day });
  const { data: weekCounts } = useScheduleWeekCounts(gw);
  const { data: lastPlayed } = useLastPlayedDay();
  const { hasData: hasPotdData } = useTopPlayersData(gw, day);
  const { data: rosterData } = useRosterQuery();
  const { data: playersData } = usePlayersQuery({ limit: 1000 });

  // Build Ballers.IQ insights for the selected day's slate
  const biq = useMemo(() => {
    const games = data?.games ?? [];
    const roster = rosterData?.roster;
    const all = playersData?.items ?? [];
    if (!games.length || !all.length || !roster) return null;
    const players = all.map((p: any) => ({
      id: p.core.id, name: p.core.name, team: p.core.team, fc_bc: p.core.fc_bc,
      salary: p.core.salary,
      fp_pg5: p.last5?.fp5, fp_pg_t: p.season?.fp,
      value5: p.last5?.value5,
      mpg: p.season?.mpg, mpg5: p.last5?.mpg5,
      stl5: p.last5?.stl5, blk5: p.last5?.blk5, ast5: p.last5?.ast5,
      delta_fp: p.last5?.delta_fp, delta_mpg: p.last5?.delta_mpg,
      injury: p.core?.injury,
    }));
    const rosterSlots = [
      ...(roster.starters ?? []).filter((id: number) => id > 0).map((id: number, i: number) => ({ player_id: id, slot: `S${i + 1}`, is_captain: id === roster.captain_id })),
      ...(roster.bench ?? []).filter((id: number) => id > 0).map((id: number, i: number) => ({ player_id: id, slot: `B${i + 1}`, is_captain: false })),
    ];
    return getBallersIQInsights("game_night", {
      players,
      roster: rosterSlots,
      schedule: games.map((g: any) => ({
        game_id: g.game_id, gw: g.gw, day: g.day,
        away_team: g.away_team, home_team: g.home_team,
        status: g.status, tipoff_utc: g.tipoff_utc,
      })),
    });
  }, [data?.games, rosterData?.roster, playersData?.items]);

  const tickerItems = useMemo(() => {
    if (!biq) return [];
    return biq.insights.slice(0, 5).map((ins) => ({
      label: ins.title,
      text: ins.headline,
    }));
  }, [biq]);

  const weekDays = useMemo(() => getDaysForWeek(gw), [gw]);
  const dateRange = useMemo(() => getWeekDateRange(gw), [gw]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const selectedDateStr = WEEK_DAY_TO_DATE[`${gw}-${day}`] ?? "";
  const isToday = selectedDateStr === todayStr;

  const selectedDateLabel = selectedDateStr
    ? format(parse(selectedDateStr, "yyyy-MM-dd", new Date()), "EEE, MMM d")
    : "";

  const deadline = DEADLINES.find((d) => d.gw === gw && d.day === day);

  const weekScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = weekScrollRef.current?.querySelector(`[data-gw="${gw}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [gw]);

  const hasTotwData = !!(weekCounts && Object.values(weekCounts).some((c) => c > 0));

  // Compute day index within the week for the gw.day label
  const dayIndexMap = useMemo(() => {
    const map: Record<number, number> = {};
    weekDays.forEach((wd, i) => { map[wd.day] = i + 1; });
    return map;
  }, [weekDays]);

  return (
    <div className="flex flex-col h-full">
      {/* ── Sticky header area ── */}
      <div className="sticky top-0 z-20 bg-background pb-0 space-y-0">
        {/* Week strip with GW info */}
        <div className="bg-[hsl(var(--nba-navy))] text-primary-foreground rounded-t-xl px-3 py-2">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="font-heading font-bold text-base dark:text-[hsl(var(--nba-yellow))]">GW {gw}</span>
            <span className="dark:text-[hsl(var(--nba-yellow))] opacity-60">|</span>
            <span className="text-xs font-body dark:text-[hsl(var(--nba-yellow))]">{dateRange}</span>
          </div>
          <div ref={weekScrollRef} className="flex gap-0.5 overflow-x-auto scrollbar-hide py-1 pr-2">
            {Array.from({ length: MAX_WEEK }, (_, i) => i + 1).map((w) => {
              const isPast = w < current.gw;
              const isCurrent = w === current.gw;
              const isSelected = w === gw;
              // A GW is fully "played" only if it is strictly before the lastPlayed gw,
              // OR equals lastPlayed.gw (in-progress played gw — emerald only when not currently selected as live).
              const isPlayed = !!lastPlayed && w < lastPlayed.gw;
              return (
                <button
                  key={w}
                  data-gw={w}
                  onClick={() => { setGw(w); setDay(getDaysForWeek(w)[0]?.day ?? 1); }}
                  className={`flex-1 min-w-[36px] py-1.5 text-[11px] font-heading font-bold rounded-xl transition-all ${
                    isSelected
                      ? "bg-[hsl(var(--nba-yellow))] text-[hsl(var(--nba-navy))] shadow-md"
                      : isPlayed
                      ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                      : isPast
                      ? "bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/50"
                      : isCurrent
                      ? "outline outline-2 outline-[hsl(var(--nba-yellow))] text-[hsl(var(--nba-yellow))] bg-white/10 hover:bg-white/20"
                      : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                  }`}
                >
                  {w}
                </button>
              );
            })}
            <span className="shrink-0 w-1" aria-hidden />
          </div>
        </div>

        {/* Day Navigator — reworked layout */}
        <div className="bg-card border-x border-b flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-7 shrink-0 rounded-none"
            disabled={gw <= MIN_WEEK && day <= (weekDays[0]?.day ?? 1)}
            onClick={() => {
              const idx = weekDays.findIndex((d) => d.day === day);
              if (idx > 0) setDay(weekDays[idx - 1].day);
              else if (gw > MIN_WEEK) { const pd = getDaysForWeek(gw - 1); setGw(gw - 1); setDay(pd[pd.length - 1]?.day ?? 1); }
            }}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          <div className="flex-1 flex gap-1 overflow-x-auto scrollbar-hide px-1">
            {weekDays.map((wd) => {
              const isSelected = wd.day === day;
              const isDayToday = wd.date === todayStr;
              const dayLabel = wd.date ? format(parse(wd.date, "yyyy-MM-dd", new Date()), "EEE").toUpperCase() : "";
              const dayNum = wd.dateObj.getDate();
              const gameCount = weekCounts?.[wd.day] ?? 0;
              const dayIdx = dayIndexMap[wd.day] ?? 1;
              // Played = strictly before the latest played day (per useLastPlayedDay).
              const isPlayed =
                !!lastPlayed &&
                (gw < lastPlayed.gw || (gw === lastPlayed.gw && wd.day <= lastPlayed.day));
              return (
                <button
                  key={wd.day}
                  onClick={() => setDay(wd.day)}
                  className={`flex-1 min-w-[80px] py-2 px-2 transition-all rounded-xl border border-[hsl(var(--nba-navy))] dark:border-[hsl(var(--nba-yellow))]/60 ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-md"
                      : isPlayed
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {/* Left: DAY + NUMBER */}
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-heading font-bold ${isSelected ? "text-primary-foreground/70" : ""}`}>{dayLabel}</span>
                      <span className="text-sm font-mono font-bold leading-tight">{dayNum}</span>
                      {isDayToday && (
                        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-[hsl(var(--nba-yellow))]" : "bg-destructive"}`} />
                      )}
                      {isPlayed && !isDayToday && (
                        <CircleCheckBig className={`h-2.5 w-2.5 ${isSelected ? "text-primary-foreground/70" : "text-emerald-500"}`} />
                      )}
                    </div>
                    {/* Center: GW.DAY */}
                    <span className={`text-xs font-heading font-black ${isSelected ? "text-primary-foreground" : "text-foreground"}`}>{gw}.{dayIdx}</span>
                    {/* Right: Game count */}
                    {gameCount > 0 && (
                      <span className={`text-xs font-mono font-bold ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {gameCount}G
                      </span>
                    )}
                    {gameCount === 0 && <span className="text-xs invisible">0G</span>}
                  </div>
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-7 shrink-0 rounded-none"
            disabled={gw >= MAX_WEEK && day >= (weekDays[weekDays.length - 1]?.day ?? 1)}
            onClick={() => {
              const idx = weekDays.findIndex((d) => d.day === day);
              if (idx < weekDays.length - 1) setDay(weekDays[idx + 1].day);
              else if (gw < MAX_WEEK) { const nd = getDaysForWeek(gw + 1); setGw(gw + 1); setDay(nd[0]?.day ?? 1); }
            }}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Date header + Deadline + Buttons */}
        <div className="px-1 py-3 bg-background">
          <div className="relative flex items-center flex-wrap gap-y-2">
            {/* LEFT: date / deadline / grid */}
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
              <h3 className="font-heading font-bold text-sm uppercase">{selectedDateLabel}</h3>
              <span className="text-[10px] text-muted-foreground font-heading bg-muted px-1.5 py-0.5 rounded-xl">Day {day}</span>
              {isToday && <Badge variant="destructive" className="text-[9px] rounded-xl px-1.5 py-0">TODAY</Badge>}
              {deadline && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span className="font-heading">Deadline <span className="font-bold text-foreground">{formatDeadline(deadline.deadline_utc)}</span></span>
                  </div>
                </>
              )}
              <span className="text-muted-foreground/40">·</span>
              <div className="inline-flex items-center rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                  title="List view"
                  aria-pressed={viewMode === "list"}
                >
                  <Rows3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                  title="Grid view"
                  aria-pressed={viewMode === "grid"}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>
              <span className="text-muted-foreground/40">·</span>
              <button
                onClick={() => setInjuryOpen(true)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1"
                title="Injury Report"
                aria-label="Open injury report"
              >
                <Bandage className="h-4 w-4" />
              </button>
              <span className="text-muted-foreground/40">·</span>
              <button
                onClick={() => navigate(`/schedule/grid?gw=${gw}`)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                title="Advanced Schedule Grid"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
            </div>

            {/* CENTER: TOTW | POTD (absolute on md+, inline on mobile) */}
            <div className="order-3 md:order-2 w-full md:w-auto flex md:absolute md:left-1/2 md:-translate-x-1/2 items-center justify-center gap-2">
              <button
                onClick={() => hasTotwData && setTotwOpen(true)}
                disabled={!hasTotwData}
                className={`flex items-center justify-center gap-1.5 min-w-[180px] px-3 py-1.5 text-xs font-heading font-bold rounded-xl border transition-all ${
                  hasTotwData
                    ? "border-[hsl(var(--nba-yellow))]/40 text-foreground hover:bg-[hsl(var(--nba-yellow))]/10 hover:border-[hsl(var(--nba-yellow))]"
                    : "border-border text-muted-foreground/40 cursor-not-allowed opacity-50"
                }`}
              >
                <Medal className="h-4 w-4" />
                Team of the Week
              </button>
              <span className="text-muted-foreground/40">|</span>
              <button
                onClick={() => hasPotdData && setPotdOpen(!potdOpen)}
                disabled={!hasPotdData}
                className={`flex items-center justify-center gap-1.5 min-w-[180px] px-3 py-1.5 text-xs font-heading font-bold rounded-xl border transition-all ${
                  hasPotdData
                    ? potdOpen
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-primary/40 text-foreground hover:bg-primary/10 hover:border-primary"
                    : "border-border text-muted-foreground/40 cursor-not-allowed opacity-50"
                }`}
              >
                <Star className="h-4 w-4" />
                Players of the Day
              </button>
            </div>

            {/* RIGHT: Last Played + Today */}
            <div className="order-2 md:order-3 flex items-center gap-1.5 shrink-0 flex-1 justify-end">
              {lastPlayed && (
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs bg-green-500/10 border-green-500/30 text-green-700 hover:bg-green-500/20 rounded-xl min-w-[120px] justify-center"
                  disabled={gw === lastPlayed.gw && day === lastPlayed.day}
                  onClick={() => { setGw(lastPlayed.gw); setDay(lastPlayed.day); }}>
                  <CircleCheckBig className="h-3 w-3" />Last Played
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs shrink-0 rounded-xl min-w-[120px] justify-center"
                disabled={gw === current.gw && day === current.day}
                onClick={() => { setGw(current.gw); setDay(current.day); }}>
                <CalendarDays className="h-3 w-3" />Today
              </Button>
            </div>
          </div>
        </div>

        {/* Collapsible Players of the Day panel */}
        <Collapsible open={potdOpen}>
          <CollapsibleContent>
            <div className="bg-card border rounded-xl mx-1 mb-2 p-3">
              <TopPlayersPanel gw={gw} day={day} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Games — scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Ballers.IQ ticker + Tonight's Edge */}
        {tickerItems.length > 0 && (
          <div className="px-1 mb-2 space-y-2">
            <BallersIQTicker items={tickerItems} />
            {biq?.insights[0] && (
              <div className="hidden md:block">
                <BallersIQCard insight={biq.insights[0]} compact />
              </div>
            )}
          </div>
        )}
        {isLoading ? (
          <div className="space-y-2 px-1">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-4 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive/60" />
            <p className="font-heading text-sm text-destructive">Couldn't load schedule</p>
            <p className="text-xs text-muted-foreground max-w-sm">The schedule request failed. Try again — your data is safe.</p>
            <Button onClick={() => refetch()} size="sm" className="rounded-xl mt-1">
              <RefreshCw className="h-3.5 w-3.5 mr-1" />Retry
            </Button>
          </div>
        ) : (
          <ScheduleList games={data?.games ?? []} viewMode={viewMode} />
        )}
      </div>

      <TeamOfTheWeekModal open={totwOpen} onOpenChange={setTotwOpen} gw={gw} />
      <InjuryReportModal open={injuryOpen} onOpenChange={setInjuryOpen} />
    </div>
  );
}
