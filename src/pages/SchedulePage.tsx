import { useState } from "react";
import { useScheduleQuery } from "@/hooks/useScheduleQuery";
import ScheduleList from "@/components/ScheduleList";
import { Skeleton } from "@/components/ui/skeleton";

export default function SchedulePage() {
  const [gw, setGw] = useState(1);
  const [day, setDay] = useState(1);
  const { data, isLoading } = useScheduleQuery({ gw, day });

  const handlePrev = () => {
    if (day > 1) setDay(day - 1);
    else { setGw(Math.max(1, gw - 1)); setDay(1); }
  };
  const handleNext = () => setDay(day + 1);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-xl font-heading font-bold">Schedule</h2>
      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <ScheduleList
          games={data?.games ?? []}
          gw={data?.gw ?? gw}
          day={data?.day ?? day}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      )}
    </div>
  );
}
