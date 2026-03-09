import { useState, useMemo, useRef, useEffect } from "react";
import { useScheduleQuery } from "@/hooks/useScheduleQuery";
import ScheduleList from "@/components/ScheduleList";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parse } from "date-fns";
import { DEADLINES, getCurrentGameday } from "@/lib/deadlines";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const MIN_WEEK = 1;
const MAX_WEEK = 25;

/** Build a map: "gw-day" → date string from DEADLINES */
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
  const { data, isLoading } = useScheduleQuery({ gw, day });

  const weekDays = useMemo(() => getDaysForWeek(gw), [gw]);
  const dateRange = useMemo(() => getWeekDateRange(gw), [gw]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const selectedDateStr = WEEK_DAY_TO_DATE[`${gw}-${day}`] ?? "";
  const isToday = selectedDateStr === todayStr;
  const isCurrentWeek = gw === current.gw;

  const selectedDateLabel = selectedDateStr
    ? format(parse(selectedDateStr, "yyyy-MM-dd", new Date()), "EEE, MMM d")
    : "";

  // Auto-scroll week pills to current
  const weekScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = weekScrollRef.current?.querySelector(`[data-gw="${gw}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [gw]);

  return (
    <div className="space-y-0">
      {/* Week Navigator — blue bar */}
      <div className="bg-primary text-primary-foreground rounded-t-sm px-4 py-3">
        <p className="text-[10px] font-heading font-bold uppercase tracking-widest mb-2 opacity-70">
          NBA Fantasy Week
        </p>
        <div ref={weekScrollRef} className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {Array.from({ length: MAX_WEEK }, (_, i) => i + 1).map((w) => (
            <button
              key={w}
              data-gw={w}
              onClick={() => { setGw(w); setDay(getDaysForWeek(w)[0]?.day ?? 1); }}
              className={`shrink-0 px-2.5 py-1 text-xs font-heading font-bold rounded-sm transition-colors ${
                w === gw
                  ? "bg-accent text-accent-foreground"
                  : "bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
              }`}
            >
              W{w}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2 text-sm">
          <span className="font-heading font-bold">Week {gw}</span>
          <span className="opacity-50">|</span>
          <span className="text-xs opacity-70">{dateRange}</span>
          {isCurrentWeek && (
            <Badge className="bg-accent text-accent-foreground text-[9px] rounded-sm px-1.5 py-0">
              CURRENT
            </Badge>
          )}
        </div>
      </div>

      {/* Day Navigator */}
      <div className="bg-card border-x border-b flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-8 shrink-0 rounded-none"
          disabled={gw <= MIN_WEEK && day <= (weekDays[0]?.day ?? 1)}
          onClick={() => {
            const idx = weekDays.findIndex((d) => d.day === day);
            if (idx > 0) {
              setDay(weekDays[idx - 1].day);
            } else if (gw > MIN_WEEK) {
              const prevDays = getDaysForWeek(gw - 1);
              setGw(gw - 1);
              setDay(prevDays[prevDays.length - 1]?.day ?? 1);
            }
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 flex overflow-x-auto scrollbar-hide">
          {weekDays.map((wd) => {
            const isSelected = wd.day === day;
            const isDayToday = wd.date === todayStr;
            const dayLabel = wd.date
              ? format(parse(wd.date, "yyyy-MM-dd", new Date()), "EEE").toUpperCase()
              : "";
            const dayNum = wd.dateObj.getDate();
            return (
              <button
                key={wd.day}
                onClick={() => setDay(wd.day)}
                className={`flex-1 min-w-[60px] py-2 px-2 text-center transition-colors border-b-2 ${
                  isSelected
                    ? "bg-primary/10 border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <div className="text-[10px] font-heading font-bold">{dayLabel}</div>
                <div className="text-sm font-mono font-bold">{dayNum}</div>
                {isDayToday && (
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive mx-auto mt-0.5" />
                )}
              </button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-8 shrink-0 rounded-none"
          disabled={gw >= MAX_WEEK && day >= (weekDays[weekDays.length - 1]?.day ?? 1)}
          onClick={() => {
            const idx = weekDays.findIndex((d) => d.day === day);
            if (idx < weekDays.length - 1) {
              setDay(weekDays[idx + 1].day);
            } else if (gw < MAX_WEEK) {
              const nextDays = getDaysForWeek(gw + 1);
              setGw(gw + 1);
              setDay(nextDays[0]?.day ?? 1);
            }
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Date header + Today button */}
      <div className="flex items-center justify-between px-1 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-heading font-bold text-sm uppercase">
            {selectedDateLabel}
          </h3>
          <span className="text-xs text-muted-foreground font-heading">
            Day {day}
          </span>
          {isToday && (
            <Badge variant="destructive" className="text-[9px] rounded-sm px-1.5 py-0">
              TODAY
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={gw === current.gw && day === current.day}
          onClick={() => { setGw(current.gw); setDay(current.day); }}
        >
          <CalendarDays className="h-3 w-3" />
          Today
        </Button>
      </div>

      {/* Games */}
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <ScheduleList games={data?.games ?? []} />
      )}
    </div>
  );
}
