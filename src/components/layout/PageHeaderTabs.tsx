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

/** Shared trigger styling so manual (non-Radix) bars match exactly. */
export const underlineTabTriggerClass =
  "rounded-none bg-transparent shadow-none px-2 py-2.5 font-heading text-[11px] uppercase tracking-wider text-muted-foreground border-b-2 border-transparent transition-colors inline-flex items-center justify-center gap-1.5";

/**
 * Manual (state-driven) variant for pages that don't use Radix Tabs.
 */
export function UnderlineTabsBarManual({
  tabs,
  value,
  onChange,
  left,
  right,
  centered = true,
  className,
}: {
  tabs: UnderlineTab[];
  value: string;
  onChange: (value: string) => void;
  left?: ReactNode;
  right?: ReactNode;
  centered?: boolean;
  className?: string;
}) {
  // When side slots are present, render them as absolutely-positioned
  // clusters so the tab group stays optically centered regardless of the
  // differing widths of the left/right content.
  if (left || right) {
    return (
      <div
        className={cn(
          "relative flex items-center border-b border-border bg-card/30 backdrop-blur-sm rounded-t-lg",
          className,
        )}
      >
        {left && (
          <div className="absolute left-0 inset-y-0 flex items-center gap-2 pl-3 pr-1">
            {left}
          </div>
        )}
        <div
          className="grid w-full max-w-3xl mx-auto"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              className={cn(
                underlineTabTriggerClass,
                value === t.value
                  ? "text-foreground border-[hsl(var(--nba-yellow))]"
                  : "hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {right && (
          <div className="absolute right-0 inset-y-0 flex items-center gap-2 pl-1 pr-1">
            {right}
          </div>
        )}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex items-center border-b border-border bg-card/30 backdrop-blur-sm rounded-t-lg",
        className,
      )}
    >
      <div
        className={cn("grid w-full", centered ? "max-w-3xl mx-auto" : "max-w-xl")}
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              underlineTabTriggerClass,
              value === t.value
                ? "text-foreground border-[hsl(var(--nba-yellow))]"
                : "hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
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