import { Button } from "@/components/ui/button";
import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import { Crown, ShieldAlert, TrendingUp, CalendarX } from "lucide-react";

interface BallersIQLineupStripProps {
  captainName?: string | null;
  riskCount: number;
  valueName?: string | null;
  scheduleDragCount: number;
  onOpen: () => void;
}

function Cell({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "default" | "warn" | "good" | "bad";
}) {
  const toneClass =
    tone === "warn"
      ? "text-amber-500"
      : tone === "bad"
        ? "text-destructive"
        : tone === "good"
          ? "text-emerald-500"
          : "text-foreground";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${toneClass}`} />
      <div className="min-w-0">
        <p className="text-[9px] font-heading font-bold uppercase tracking-wider text-muted-foreground leading-none">
          {label}
        </p>
        <p className={`text-xs font-heading font-bold uppercase truncate leading-tight ${toneClass}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

export default function BallersIQLineupStrip({
  captainName,
  riskCount,
  valueName,
  scheduleDragCount,
  onOpen,
}: BallersIQLineupStripProps) {
  return (
    <div className="mb-3 rounded-xl border border-amber-400/30 bg-card/80 backdrop-blur-sm px-3 py-2 flex items-center gap-3 flex-wrap shrink-0 ring-1 ring-amber-400/10">
      <div className="flex items-center gap-2 shrink-0">
        <BallersIQBrand variant="emblem" forceTheme="light" transparent className="!h-4 !w-4 dark:hidden" />
        <BallersIQBrand variant="emblem" forceTheme="dark" transparent className="!h-4 !w-4 hidden dark:block" />
        <span className="text-[10px] font-heading font-bold uppercase tracking-widest text-amber-500">
          Ballers.IQ
        </span>
      </div>
      <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
        <Cell icon={Crown} label="Captain Edge" value={captainName ?? "—"} tone="good" />
        <Cell
          icon={ShieldAlert}
          label="Risk Radar"
          value={riskCount > 0 ? `${riskCount} starter${riskCount === 1 ? "" : "s"}` : "Clear"}
          tone={riskCount >= 2 ? "bad" : riskCount === 1 ? "warn" : "good"}
        />
        <Cell icon={TrendingUp} label="Value Pick" value={valueName ?? "—"} tone="default" />
        <Cell
          icon={CalendarX}
          label="Schedule Drag"
          value={
            scheduleDragCount > 0
              ? `${scheduleDragCount} no-game`
              : "All playing"
          }
          tone={scheduleDragCount >= 2 ? "bad" : scheduleDragCount === 1 ? "warn" : "good"}
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onOpen}
        className="rounded-xl font-heading uppercase text-[10px] h-7 px-2.5 border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-500 hover:border-amber-400/70 shrink-0"
      >
        Open Ballers.IQ
      </Button>
    </div>
  );
}