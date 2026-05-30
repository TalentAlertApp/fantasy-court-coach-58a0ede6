import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FilterX } from "lucide-react";
import { BADGE_LEGEND, BADGE_TONE_TEXT, BADGE_TONE_GLOW } from "./badgeLegend";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

/**
 * Icon-only filter — pick one or more contextual badges. A player is shown when
 * at least one of their badges matches the selection. Visual language is kept
 * consistent with PlayerContextBadges (standalone icons, no containers, surge
 * hover); the selected state is signaled with a soft ring + active glow.
 */
export default function BadgeFilter({ value, onChange }: Props) {
  const selected = new Set(value);
  const toggle = (k: string) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onChange(Array.from(next));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label className="text-[10px] font-heading font-bold uppercase text-muted-foreground block tracking-wider">
          Market Status
        </Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={value.length === 0}
              aria-label="Deselect all"
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded-md transition-all",
                value.length > 0
                  ? "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] hover:scale-110 cursor-pointer"
                  : "text-muted-foreground/40 cursor-default",
              )}
            >
              <FilterX className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px]">Deselect all</TooltipContent>
        </Tooltip>
      </div>
      <div className="grid grid-cols-7 gap-y-2 gap-x-1 py-0.5">
        {BADGE_LEGEND.map(({ key, icon: Icon, tone, label }) => {
          const isOn = selected.has(key);
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-pressed={isOn}
                  aria-label={label}
                  className={cn(
                    "group relative inline-flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200 ease-out",
                    "hover:scale-125 hover:-translate-y-0.5",
                    isOn
                      ? "bg-foreground/[0.06] ring-1 ring-foreground/15"
                      : "opacity-60 hover:opacity-100",
                  )}
                >
                  <Icon
                    strokeWidth={2.25}
                    className={cn(
                      "h-3.5 w-3.5 transition-all",
                      BADGE_TONE_TEXT[tone],
                      BADGE_TONE_GLOW[tone],
                      isOn && "brightness-125 drop-shadow-[0_0_6px_currentColor]",
                    )}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">
                {label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}