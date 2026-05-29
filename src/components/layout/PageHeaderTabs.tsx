import type { ReactNode } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * Shared page header chrome modelled on the /advanced layout:
 * a tiny centered caption over a full-width, underline-style tab bar
 * (transparent list, bottom border on the row, yellow underline on the
 * active tab). Keeps the four main pages visually in sync.
 */

export function PageHeaderCaption({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <span className="text-[10px] font-heading uppercase tracking-[0.4em] text-muted-foreground text-center">
        {children}
      </span>
    </div>
  );
}

export interface UnderlineTab {
  value: string;
  label: ReactNode;
}

export function UnderlineTabsBar({
  tabs,
  right,
  centered = true,
  className,
}: {
  tabs: UnderlineTab[];
  /** Optional controls aligned to the far right of the bar. */
  right?: ReactNode;
  /** Center the tab group (no right controls) vs. left-align it. */
  centered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center border-b border-border bg-card/30 backdrop-blur-sm rounded-t-lg",
        className,
      )}
    >
      <TabsList
        className={cn(
          "bg-transparent p-0 h-auto grid w-full",
          centered && !right ? "max-w-3xl mx-auto" : "max-w-xl",
        )}
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="rounded-none bg-transparent shadow-none px-2 py-2.5 font-heading text-[11px] uppercase tracking-wider text-muted-foreground border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:border-[hsl(var(--nba-yellow))] data-[state=active]:shadow-none transition-colors inline-flex items-center justify-center gap-1.5"
          >
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {right && <div className="ml-auto shrink-0 flex items-center gap-2 pl-3 pr-1">{right}</div>}
    </div>
  );
}