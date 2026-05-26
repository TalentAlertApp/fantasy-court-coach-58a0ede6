import { useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLeague } from "@/contexts/LeagueContext";
import { useLeagueDeadlines } from "@/hooks/useLeagueDeadlines";
import { getCurrentGameday } from "@/lib/deadlines";
import { getCurrentGamedayFrom } from "@/hooks/useLeagueDeadlines";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function useCountdown(deadlineUtc: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!deadlineUtc) return null;
  const diff = new Date(deadlineUtc).getTime() - now;
  if (diff <= 0) return { locked: true, label: "LOCKED", minutes: 0 };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    locked: false,
    label: `${pad(h)}:${pad(m)}:${pad(s)}`,
    minutes: Math.floor(diff / 60000),
  };
}

export default function SidebarNextLock({ collapsed }: { collapsed: boolean }) {
  const { league } = useLeague();
  const { deadlines } = useLeagueDeadlines();

  const currentGameday = useMemo(() => {
    if (league === "wnba" || league === "euroleague") {
      const gd = getCurrentGamedayFrom(deadlines);
      if (gd) return gd;
    }
    return getCurrentGameday();
  }, [league, deadlines]);

  const cd = useCountdown(currentGameday?.deadline_utc ?? null);
  if (!currentGameday || !cd) return null;

  const urgent = !cd.locked && cd.minutes <= 30;
  const valueColor = cd.locked
    ? "text-destructive"
    : urgent
    ? "text-destructive"
    : "text-accent";

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "relative mx-auto flex items-center justify-center h-9 w-9 rounded-lg border",
              cd.locked || urgent
                ? "border-destructive/50 bg-destructive/10"
                : "border-accent/40 bg-accent/10",
            )}
            aria-label={`Next lock ${cd.label}`}
          >
            <Lock className={cn("h-4 w-4", valueColor)} />
            {!cd.locked && urgent && (
              <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          sideOffset={12}
          className="font-heading uppercase text-[10px] tracking-[0.2em] px-2.5 py-1.5"
        >
          Next Lock · {cd.label} · GW {currentGameday.gw}.{currentGameday.day}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-lg border px-3 py-2",
        "bg-white/[0.03] backdrop-blur-sm",
        cd.locked || urgent ? "border-destructive/40" : "border-white/10",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-heading font-bold uppercase tracking-[0.22em] text-white/55">
          Next Lock
        </div>
        <div
          className={cn(
            "font-mono font-black text-lg leading-none tabular-nums mt-1",
            valueColor,
          )}
        >
          {cd.label}
        </div>
        <div className="text-[10px] text-white/55 mt-0.5">
          Gameweek {currentGameday.gw}.{currentGameday.day}
        </div>
      </div>
      <div
        className={cn(
          "flex items-center justify-center h-9 w-9 rounded-full border shrink-0",
          cd.locked || urgent
            ? "border-destructive/50 bg-destructive/10"
            : "border-accent/40 bg-accent/10",
        )}
      >
        <Lock className={cn("h-4 w-4", valueColor)} />
      </div>
    </div>
  );
}