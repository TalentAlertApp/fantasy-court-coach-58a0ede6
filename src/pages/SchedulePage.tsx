import { useState, useMemo } from "react";
import { useScheduleQuery } from "@/hooks/useScheduleQuery";
import ScheduleList from "@/components/ScheduleList";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { format, parse } from "date-fns";

const CALENDAR: Record<string, { week: number; day: number }> = {
  // GW1 (6 days)
  '2025-10-22': { week: 1, day: 2 }, // D1 & D2 same date, D2 wins
  '2025-10-24': { week: 1, day: 3 },
  '2025-10-25': { week: 1, day: 5 }, // D4 & D5 same date
  '2025-10-26': { week: 1, day: 6 },
  // GW2 (7 days)
  '2025-10-27': { week: 2, day: 1 },
  '2025-10-28': { week: 2, day: 2 },
  '2025-10-29': { week: 2, day: 3 },
  '2025-10-30': { week: 2, day: 4 },
  '2025-10-31': { week: 2, day: 5 },
  '2025-11-01': { week: 2, day: 6 },
  '2025-11-02': { week: 2, day: 7 },
  // GW3 (7 days)
  '2025-11-03': { week: 3, day: 1 },
  '2025-11-05': { week: 3, day: 3 }, // D2 & D3 same date
  '2025-11-07': { week: 3, day: 5 }, // D4 & D5 same date
  '2025-11-08': { week: 3, day: 6 },
  '2025-11-09': { week: 3, day: 7 },
  // GW4 (7 days)
  '2025-11-10': { week: 4, day: 1 },
  '2025-11-12': { week: 4, day: 3 }, // D2 & D3 same date
  '2025-11-13': { week: 4, day: 4 },
  '2025-11-14': { week: 4, day: 5 },
  '2025-11-15': { week: 4, day: 6 },
  '2025-11-16': { week: 4, day: 7 },
  // GW5 (7 days)
  '2025-11-17': { week: 5, day: 1 },
  '2025-11-18': { week: 5, day: 2 },
  '2025-11-19': { week: 5, day: 3 },
  '2025-11-20': { week: 5, day: 4 },
  '2025-11-21': { week: 5, day: 5 },
  '2025-11-22': { week: 5, day: 6 },
  '2025-11-23': { week: 5, day: 7 },
  // GW6 (6 days)
  '2025-11-24': { week: 6, day: 1 },
  '2025-11-25': { week: 6, day: 2 },
  '2025-11-26': { week: 6, day: 3 },
  '2025-11-29': { week: 6, day: 5 }, // D4 & D5 same date
  '2025-11-30': { week: 6, day: 6 },
  // GW7 (7 days)
  '2025-12-01': { week: 7, day: 1 },
  '2025-12-02': { week: 7, day: 2 },
  '2025-12-03': { week: 7, day: 3 },
  '2025-12-04': { week: 7, day: 4 },
  '2025-12-05': { week: 7, day: 5 },
  '2025-12-06': { week: 7, day: 6 },
  '2025-12-07': { week: 7, day: 7 },
  // GW8 (7 days)
  '2025-12-08': { week: 8, day: 1 },
  '2025-12-09': { week: 8, day: 2 },
  '2025-12-11': { week: 8, day: 3 },
  '2025-12-12': { week: 8, day: 5 }, // D4 & D5 same date
  '2025-12-13': { week: 8, day: 6 },
  '2025-12-14': { week: 8, day: 7 },
  // GW9 (6 days)
  '2025-12-15': { week: 9, day: 1 },
  '2025-12-18': { week: 9, day: 3 }, // D2 & D3 same date
  '2025-12-19': { week: 9, day: 4 },
  '2025-12-20': { week: 9, day: 5 },
  '2025-12-21': { week: 9, day: 6 },
  // GW10 (6 days)
  '2025-12-22': { week: 10, day: 1 },
  '2025-12-23': { week: 10, day: 2 },
  '2025-12-25': { week: 10, day: 3 },
  '2025-12-26': { week: 10, day: 4 },
  '2025-12-27': { week: 10, day: 5 },
  '2025-12-28': { week: 10, day: 6 },
  // GW11 (7 days)
  '2025-12-29': { week: 11, day: 1 },
  '2025-12-31': { week: 11, day: 3 }, // D2 & D3 same date
  '2026-01-01': { week: 11, day: 4 },
  '2026-01-02': { week: 11, day: 5 },
  '2026-01-03': { week: 11, day: 6 },
  '2026-01-04': { week: 11, day: 7 },
  // GW12 (7 days)
  '2026-01-05': { week: 12, day: 1 },
  '2026-01-06': { week: 12, day: 2 },
  '2026-01-07': { week: 12, day: 3 },
  '2026-01-08': { week: 12, day: 4 },
  '2026-01-09': { week: 12, day: 5 },
  '2026-01-10': { week: 12, day: 6 },
  '2026-01-11': { week: 12, day: 7 },
  // GW13 (7 days)
  '2026-01-12': { week: 13, day: 1 },
  '2026-01-14': { week: 13, day: 3 }, // D2 & D3 same date
  '2026-01-15': { week: 13, day: 4 },
  '2026-01-16': { week: 13, day: 5 },
  '2026-01-17': { week: 13, day: 6 },
  '2026-01-18': { week: 13, day: 7 },
  // GW14 (7 days)
  '2026-01-19': { week: 14, day: 1 },
  '2026-01-20': { week: 14, day: 2 },
  '2026-01-21': { week: 14, day: 3 },
  '2026-01-22': { week: 14, day: 4 },
  '2026-01-23': { week: 14, day: 5 },
  '2026-01-24': { week: 14, day: 6 },
  '2026-01-25': { week: 14, day: 7 },
  // GW15 (7 days)
  '2026-01-26': { week: 15, day: 1 },
  '2026-01-27': { week: 15, day: 2 },
  '2026-01-28': { week: 15, day: 3 },
  '2026-01-29': { week: 15, day: 4 },
  '2026-01-30': { week: 15, day: 5 },
  '2026-01-31': { week: 15, day: 6 },
  '2026-02-01': { week: 15, day: 7 },
  // GW16 (7 days)
  '2026-02-02': { week: 16, day: 1 },
  '2026-02-03': { week: 16, day: 2 },
  '2026-02-04': { week: 16, day: 3 },
  '2026-02-05': { week: 16, day: 4 },
  '2026-02-07': { week: 16, day: 6 }, // D5 & D6 same date
  '2026-02-08': { week: 16, day: 7 },
  // GW17 (4 days)
  '2026-02-09': { week: 17, day: 1 },
  '2026-02-11': { week: 17, day: 3 }, // D2 & D3 same date
  '2026-02-13': { week: 17, day: 4 },
  // GW18 (4 days)
  '2026-02-19': { week: 18, day: 1 },
  '2026-02-20': { week: 18, day: 2 },
  '2026-02-21': { week: 18, day: 3 },
  '2026-02-22': { week: 18, day: 4 },
  // GW19 (7 days)
  '2026-02-23': { week: 19, day: 1 },
  '2026-02-24': { week: 19, day: 2 },
  '2026-02-26': { week: 19, day: 4 }, // D3 & D4 same date
  '2026-02-27': { week: 19, day: 5 },
  '2026-02-28': { week: 19, day: 6 },
  '2026-03-01': { week: 19, day: 7 },
  // GW20 (7 days)
  '2026-03-02': { week: 20, day: 1 },
  '2026-03-03': { week: 20, day: 2 },
  '2026-03-04': { week: 20, day: 3 },
  '2026-03-05': { week: 20, day: 4 },
  '2026-03-06': { week: 20, day: 5 },
  '2026-03-07': { week: 20, day: 6 },
  '2026-03-08': { week: 20, day: 7 },
  // GW21–25 (existing)
  '2026-03-09': { week: 21, day: 1 },
  '2026-03-10': { week: 21, day: 2 },
  '2026-03-11': { week: 21, day: 3 },
  '2026-03-12': { week: 21, day: 4 },
  '2026-03-13': { week: 21, day: 5 },
  '2026-03-14': { week: 21, day: 6 },
  '2026-03-15': { week: 21, day: 7 },
  '2026-03-16': { week: 22, day: 1 },
  '2026-03-17': { week: 22, day: 2 },
  '2026-03-18': { week: 22, day: 3 },
  '2026-03-19': { week: 22, day: 4 },
  '2026-03-20': { week: 22, day: 5 },
  '2026-03-21': { week: 22, day: 6 },
  '2026-03-22': { week: 22, day: 7 },
  '2026-03-23': { week: 23, day: 1 },
  '2026-03-24': { week: 23, day: 2 },
  '2026-03-25': { week: 23, day: 3 },
  '2026-03-26': { week: 23, day: 4 },
  '2026-03-27': { week: 23, day: 5 },
  '2026-03-28': { week: 23, day: 6 },
  '2026-03-29': { week: 23, day: 7 },
  '2026-03-30': { week: 24, day: 1 },
  '2026-03-31': { week: 24, day: 2 },
  '2026-04-01': { week: 24, day: 3 },
  '2026-04-02': { week: 24, day: 4 },
  '2026-04-03': { week: 24, day: 5 },
  '2026-04-04': { week: 24, day: 6 },
  '2026-04-05': { week: 24, day: 7 },
  '2026-04-06': { week: 25, day: 1 },
  '2026-04-07': { week: 25, day: 2 },
  '2026-04-08': { week: 25, day: 3 },
  '2026-04-09': { week: 25, day: 4 },
  '2026-04-10': { week: 25, day: 5 },
  '2026-04-12': { week: 25, day: 6 },
};

const DAYS_IN_WEEK: Record<number, number> = {
  1: 6, 6: 6, 9: 6, 10: 6, 17: 4, 18: 4,
};
const daysInWeek = (w: number) => DAYS_IN_WEEK[w] || 7;

const MIN_WEEK = 1;
const MAX_WEEK = 25;

function getInitialWeekDay(): { week: number; day: number } {
  const today = new Date().toISOString().slice(0, 10);
  const entry = CALENDAR[today];
  if (entry) return entry;
  // Find closest past date
  const sorted = Object.keys(CALENDAR).sort();
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i] <= today) return CALENDAR[sorted[i]];
  }
  return { week: MIN_WEEK, day: 1 };
}

// Build reverse lookup: { "21-1": "2026-03-09", ... }
const WEEK_DAY_TO_DATE: Record<string, string> = {};
for (const [dateStr, wd] of Object.entries(CALENDAR)) {
  WEEK_DAY_TO_DATE[`${wd.week}-${wd.day}`] = dateStr;
}

function getDateLabel(week: number, day: number): string | null {
  const dateStr = WEEK_DAY_TO_DATE[`${week}-${day}`];
  if (!dateStr) return null;
  const d = parse(dateStr, 'yyyy-MM-dd', new Date());
  return format(d, 'EEE MMM d');
}

export default function SchedulePage() {
  const initial = useMemo(getInitialWeekDay, []);
  const [gw, setGw] = useState(initial.week);
  const [day, setDay] = useState(initial.day);
  const { data, isLoading } = useScheduleQuery({ gw, day });

  const maxDay = daysInWeek(gw);
  const dateLabel = useMemo(() => getDateLabel(gw, day), [gw, day]);

  const changeDay = (delta: number) => {
    const next = day + delta;
    if (next < 1) {
      if (gw > MIN_WEEK) {
        const prevWeek = gw - 1;
        setGw(prevWeek);
        setDay(daysInWeek(prevWeek));
      }
    } else if (next > maxDay) {
      if (gw < MAX_WEEK) { setGw(gw + 1); setDay(1); }
    } else {
      setDay(next);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-xl font-heading font-bold">Schedule</h2>

      {/* Day-centric navigation */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeDay(-1)} disabled={day <= 1 && gw <= MIN_WEEK}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="text-center">
          <span className="font-heading font-bold text-sm uppercase tracking-wide">
            Week {gw}
          </span>
          <span className="text-muted-foreground mx-1.5">·</span>
          <span className="font-heading font-bold text-sm uppercase tracking-wide">
            Day {day}
          </span>
          {dateLabel && (
            <span className="text-sm text-muted-foreground ml-2">{dateLabel}</span>
          )}
        </div>

        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeDay(1)} disabled={day >= maxDay && gw >= MAX_WEEK}>
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={gw === initial.week && day === initial.day}
          onClick={() => { setGw(initial.week); setDay(initial.day); }}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Today
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <ScheduleList games={data?.games ?? []} />
      )}
    </div>
  );
}
