import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useScheduleQuery } from "@/hooks/useScheduleQuery";
import TeamOfTheWeekModal from "@/components/TeamOfTheWeekModal";
import { useScheduleWeekCounts } from "@/hooks/useScheduleWeekCounts";
import { useLastPlayedDay } from "@/hooks/useLastPlayedDay";
import ScheduleList from "@/components/ScheduleList";
import TopPlayersStrip from "@/components/TopPlayersStrip";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, CircleCheckBig, Grid3X3, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parse } from "date-fns";
import { DEADLINES, getCurrentGameday, formatDeadline } from "@/lib/deadlines";

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
  const navigate = useNavigate();
  const { data, isLoading } = useScheduleQuery({ gw, day });
  const { data: weekCounts } = useScheduleWeekCounts(gw);
  const { data: lastPlayed } = useLastPlayedDay();

  const weekDays = useMemo(() => getDaysForWeek(gw), [gw]);
  const dateRange = useMemo(() => getWeekDateRange(gw), [gw]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const selectedDateStr = WEEK_DAY_TO_DATE[`${gw}-${day}`] ?? "";
  const isToday = selectedDateStr === todayStr;
  const isCurrentWeek = gw === current.gw;

  const selectedDateLabel = selectedDateStr
    ? format(parse(selectedDateStr, "yyyy-MM-dd", new Date()), "EEE, MMM d")
    : "";

  const deadline = DEADLINES.find((d) => d.gw === gw && d.day === day);

  const weekScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = weekScrollRef.current?.querySelector(`[data-gw="${gw}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [gw]);

  return (
    <div className="space-y-0">
      {/* Week Navigator */}
      <div className="bg-[hsl(var(--nba-navy))] text-primary-foreground rounded-t-sm px-3 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-heading font-bold uppercase tracking-[0.2em] opacity-60">
            NBA Fantasy · Season 2025-26
          </p>
          {isCurrentWeek && (
            <Badge className="bg-[hsl(var(--nba-yellow))] text-[hsl(var(--nba-navy))] text-[9px] rounded-lg px-1.5 py-0 font-heading font-bold">
              CURRENT WEEK
            </Badge>
          )}
        </div>
        <div ref={weekScrollRef} className="flex gap-0.5 overflow-x-auto scrollbar-hide pb-1">
          {Array.from({ length: MAX_WEEK }, (_, i) => i + 1).map((w) => {
            const isPast = w < current.gw;
            const isCurrent = w === current.gw;
            const isSelected = w === gw;
            return (
              <button
                key={w}
                data-gw={w}
                onClick={() => { setGw(w); setDay(getDaysForWeek(w)[0]?.day ?? 1); }}
                className={`flex-1 min-w-[36px] py-1.5 text-[11px] font-heading font-bold rounded-lg transition-all ${
                  isSelected
                    ? "bg-[hsl(var(--nba-yellow))] text-[hsl(var(--nba-navy))] shadow-md"
                    : isPast
                    ? "bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/50"
                    : isCurrent
                    ? "bg-primary/80 text-white hover:bg-primary"
                    : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                }`}
              >
                {w}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-2 text-sm">
          <span className="font-heading font-bold text-base">GW {gw}</span>
          <span className="opacity-30">|</span>
          <span className="text-xs opacity-60 font-body">{dateRange}</span>
          <button
            onClick={() => navigate(`/schedule/grid?gw=${gw}`)}
            className="ml-1 p-1 rounded-lg transition-colors bg-white/10 text-white/70 hover:bg-white/20"
            title="Advanced Schedule Grid"
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTotwOpen(true)}
            className="p-1 rounded-lg transition-colors bg-white/10 text-white/70 hover:bg-white/20"
            title="Team of the Week"
          >
            <Trophy className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Day Navigator — compact */}
      <div className="bg-card border-x border-b flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-7 shrink-0 rounded-none"
          disabled={gw <= MIN_WEEK && day <= (weekDays[0]?.day ?? 1)}
          onClick={() => {
            const idx = weekDays.findIndex((d) => d.day === day);
            if (idx > 0) setDay(weekDays[idx - 1].day);
            else if (gw > MIN_WEEK) { const pd = getDaysForWeek(gw - 1); setGw(gw - 1); setDay(pd[pd.length - 1]?.day ?? 1); }
          }}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>

        <div className="flex-1 flex overflow-x-auto scrollbar-hide">
          {weekDays.map((wd) => {
            const isSelected = wd.day === day;
            const isDayToday = wd.date === todayStr;
            const dayLabel = wd.date ? format(parse(wd.date, "yyyy-MM-dd", new Date()), "EEE").toUpperCase() : "";
            const dayNum = wd.dateObj.getDate();
            const gameCount = weekCounts?.[wd.day] ?? 0;
            return (
              <button
                key={wd.day}
                onClick={() => setDay(wd.day)}
                className={`flex-1 min-w-[48px] py-1 px-1 text-center transition-all border-b-2 ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-[hsl(var(--nba-yellow))]"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <div className={`text-[8px] font-heading font-bold ${isSelected ? "text-primary-foreground/70" : ""}`}>{dayLabel}</div>
                <div className={`text-xs font-mono font-bold leading-tight`}>{dayNum}</div>
                <div className="flex items-center justify-center gap-0.5 mt-0.5">
                  {isDayToday && (
                    <div className={`w-1 h-1 rounded-full ${isSelected ? "bg-[hsl(var(--nba-yellow))]" : "bg-destructive"}`} />
                  )}
                  {gameCount > 0 && (
                    <span className={`text-[8px] font-mono ${isSelected ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                      {gameCount}G
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-7 shrink-0 rounded-none"
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

      {/* Top Players Strip */}
      <TopPlayersStrip gw={gw} day={day} />

      {/* Date header + Deadline */}
      <div className="px-1 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-heading font-bold text-sm uppercase">{selectedDateLabel}</h3>
            <span className="text-[10px] text-muted-foreground font-heading bg-muted px-1.5 py-0.5 rounded-lg">Day {day}</span>
            {isToday && <Badge variant="destructive" className="text-[9px] rounded-lg px-1.5 py-0">TODAY</Badge>}
            {deadline && (
              <>
                <span className="text-muted-foreground">·</span>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="font-heading">Deadline <span className="font-bold text-foreground">{formatDeadline(deadline.deadline_utc)}</span></span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {lastPlayed && (
              <Button variant="outline" size="sm" className="h-7 gap-1 text-xs bg-green-500/10 border-green-500/30 text-green-700 hover:bg-green-500/20"
                disabled={gw === lastPlayed.gw && day === lastPlayed.day}
                onClick={() => { setGw(lastPlayed.gw); setDay(lastPlayed.day); }}>
                <CircleCheckBig className="h-3 w-3" />Last Played
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs shrink-0"
              disabled={gw === current.gw && day === current.day}
              onClick={() => { setGw(current.gw); setDay(current.day); }}>
              <CalendarDays className="h-3 w-3" />Today
            </Button>
          </div>
        </div>
      </div>

      {/* Games */}
      {isLoading ? (
        <div className="space-y-2 px-1">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
      ) : (
        <ScheduleList games={data?.games ?? []} />
      )}

      <TeamOfTheWeekModal open={totwOpen} onOpenChange={setTotwOpen} gw={gw} />
    </div>
  );
}
