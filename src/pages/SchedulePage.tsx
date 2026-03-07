import { useState, useMemo } from "react";
import { useScheduleQuery } from "@/hooks/useScheduleQuery";
import ScheduleList from "@/components/ScheduleList";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const CALENDAR: Record<string, { week: number; day: number }> = {
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

const MIN_WEEK = 21;
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

export default function SchedulePage() {
  const initial = useMemo(getInitialWeekDay, []);
  const [gw, setGw] = useState(initial.week);
  const [day, setDay] = useState(initial.day);
  const { data, isLoading } = useScheduleQuery({ gw, day });

  const changeWeek = (delta: number) => {
    const next = gw + delta;
    if (next >= MIN_WEEK && next <= MAX_WEEK) setGw(next);
  };

  const changeDay = (delta: number) => {
    const next = day + delta;
    if (next < 1) {
      if (gw > MIN_WEEK) { setGw(gw - 1); setDay(7); }
    } else if (next > 7) {
      if (gw < MAX_WEEK) { setGw(gw + 1); setDay(1); }
    } else {
      setDay(next);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-xl font-heading font-bold">Schedule</h2>

      {/* Week + Day selectors */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeWeek(-1)} disabled={gw <= MIN_WEEK}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-heading font-bold text-sm uppercase tracking-wide min-w-[90px] text-center">
            Week {gw}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeWeek(1)} disabled={gw >= MAX_WEEK}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeDay(-1)} disabled={day <= 1 && gw <= MIN_WEEK}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-heading font-bold text-sm uppercase tracking-wide min-w-[60px] text-center">
            Day {day}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeDay(1)} disabled={day >= 7 && gw >= MAX_WEEK}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <ScheduleList games={data?.games ?? []} />
      )}
    </div>
  );
}
