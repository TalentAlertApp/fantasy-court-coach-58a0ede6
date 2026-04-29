import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type HeaderTone = "blue" | "red" | "green" | "yellow" | "neutral";

const TONE: Record<HeaderTone, { wrap: string; icon: string }> = {
  blue:    { wrap: "bg-primary/10 border-b border-primary/20",                 icon: "text-primary" },
  red:     { wrap: "bg-destructive/10 border-b border-destructive/20",         icon: "text-destructive" },
  green:   { wrap: "bg-emerald-500/10 border-b border-emerald-500/20",         icon: "text-emerald-500" },
  yellow:  { wrap: "bg-[hsl(var(--nba-yellow))]/10 border-b border-[hsl(var(--nba-yellow))]/30", icon: "text-[hsl(var(--nba-yellow))]" },
  neutral: { wrap: "bg-muted/40 border-b border-border",                       icon: "text-muted-foreground" },
};

interface Props {
  tone?: HeaderTone;
  icon?: ReactNode;
  title: string;
  meta?: ReactNode;
  rightSlot?: ReactNode;
  className?: string;
}

export default function SectionHeader({
  tone = "blue",
  icon,
  title,
  meta,
  rightSlot,
  className,
}: Props) {
  const t = TONE[tone];
  return (
    <div className={cn("flex items-center gap-2 px-4 py-2.5", t.wrap, className)}>
      {icon && <span className={cn("inline-flex items-center", t.icon)}>{icon}</span>}
      <span className="text-xs font-heading font-bold uppercase tracking-wider truncate">
        {title}
      </span>
      {meta && (
        <span className="text-[10px] text-muted-foreground ml-auto truncate font-heading uppercase tracking-wider">
          {meta}
        </span>
      )}
      {rightSlot && <div className={cn("ml-auto", meta && "ml-2")}>{rightSlot}</div>}
    </div>
  );
}