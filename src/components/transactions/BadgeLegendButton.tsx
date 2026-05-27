import {
  ShieldAlert,
  BadgeAlert,
  Gem,
  Flame,
  Snowflake,
  CalendarPlus,
  CalendarX,
  CalendarClock,
  TrendingUp,
  ClockAlert,
  Crown,
  Puzzle,
  CheckCircle2,
  Star,
  Info,
  type LucideIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { BadgeTone } from "./PlayerContextBadges";

const TONE_CLS: Record<BadgeTone, string> = {
  red: "text-red-400",
  amber: "text-amber-300",
  gold: "text-yellow-300",
  green: "text-emerald-300",
  blue: "text-sky-300",
  slate: "text-slate-400",
  violet: "text-violet-300",
};

const LEGEND: { icon: LucideIcon; tone: BadgeTone; label: string }[] = [
  { icon: ShieldAlert,   tone: "amber",  label: "Health risk" },
  { icon: BadgeAlert,    tone: "amber",  label: "Salary trap" },
  { icon: Gem,           tone: "green",  label: "Value add" },
  { icon: Flame,         tone: "green",  label: "Hot form" },
  { icon: Snowflake,     tone: "blue",   label: "Cold form" },
  { icon: CalendarPlus,  tone: "green",  label: "Sched boost" },
  { icon: CalendarX,     tone: "amber",  label: "No game" },
  { icon: CalendarClock, tone: "slate",  label: "Light week" },
  { icon: TrendingUp,    tone: "green",  label: "Role boost" },
  { icon: ClockAlert,    tone: "amber",  label: "Minutes risk" },
  { icon: Crown,         tone: "gold",   label: "Captain edge" },
  { icon: Puzzle,        tone: "blue",   label: "Roster fit" },
  { icon: CheckCircle2,  tone: "blue",   label: "Owned" },
  { icon: Star,          tone: "violet", label: "Watchlist" },
];

export default function BadgeLegendButton({ className }: { className?: string }) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Player icon legend"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center text-muted-foreground transition-all duration-200",
                "hover:text-amber-300 hover:scale-110 hover:drop-shadow-[0_0_8px_rgba(252,211,77,0.55)]",
                className,
              )}
            >
              <Info className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Icon legend</TooltipContent>
      </Tooltip>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-[260px] p-2.5 bg-background/95 backdrop-blur-md border-border/60"
      >
        <div className="text-[10px] font-heading font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2 px-1">
          Player Icons
        </div>
        <ul className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          {LEGEND.map(({ icon: Icon, tone, label }) => (
            <li key={label} className="flex items-center gap-1.5 px-1 py-0.5">
              <Icon strokeWidth={2.25} className={cn("h-3.5 w-3.5 shrink-0", TONE_CLS[tone])} />
              <span className="text-[11px] text-foreground/85 truncate">{label}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}