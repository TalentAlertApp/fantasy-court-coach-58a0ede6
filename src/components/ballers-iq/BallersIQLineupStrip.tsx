import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import { Crown, ShieldAlert, TrendingUp, CalendarX } from "lucide-react";

interface BallersIQLineupStripProps {
  captainName?: string | null;
  riskCount: number;
  valueName?: string | null;
  scheduleDragCount: number;
  className?: string;
  onOpen?: () => void;
}

function Cell({
  icon: Icon,
  label,
  value,
  tone = "default",
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "default" | "warn" | "good" | "bad";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "warn"
      ? "text-amber-400"
      : tone === "bad"
        ? "text-red-400"
        : tone === "good"
          ? "text-emerald-400"
          : "text-primary-foreground";
  const Wrapper: any = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex items-center gap-1.5 min-w-0 text-left ${onClick ? "hover:opacity-90 transition-opacity cursor-pointer" : ""}`}
    >
      <Icon className={`h-3 w-3 shrink-0 ${toneClass}`} />
      <div className="min-w-0 leading-tight">
        <p className="text-[8px] font-heading font-bold uppercase tracking-widest text-primary-foreground/60 leading-none">
          {label}
        </p>
        <p className={`text-[11px] font-heading font-bold uppercase truncate leading-tight ${toneClass}`}>
          {value}
        </p>
      </div>
    </Wrapper>
  );
}

export default function BallersIQLineupStrip({
  captainName,
  riskCount,
  valueName,
  scheduleDragCount,
  className,
  onOpen,
}: BallersIQLineupStripProps) {
  return (
    <div className={`rounded-lg border border-primary-foreground/15 bg-primary-foreground/5 px-2.5 py-1.5 flex items-center gap-3 flex-wrap ${className ?? ""}`}>
      <div className="flex items-center gap-1.5 shrink-0">
        <BallersIQBrand variant="emblem" forceTheme="dark" transparent className="!h-3.5 !w-3.5" />
        <span className="text-[9px] font-heading font-bold uppercase tracking-widest text-accent">
          Ballers.IQ
        </span>
      </div>
      <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5">
        <Cell icon={Crown} label="Captain Edge" value={captainName ?? "—"} tone="good" onClick={onOpen} />
        <Cell
          icon={ShieldAlert}
          label="Risk Radar"
          value={riskCount > 0 ? `${riskCount} starter${riskCount === 1 ? "" : "s"}` : "Clear"}
          tone={riskCount >= 2 ? "bad" : riskCount === 1 ? "warn" : "good"}
          onClick={onOpen}
        />
        <Cell icon={TrendingUp} label="Value Pick" value={valueName ?? "—"} onClick={onOpen} />
        <Cell
          icon={CalendarX}
          label="Schedule Drag"
          value={scheduleDragCount > 0 ? `${scheduleDragCount} no-game` : "All playing"}
          tone={scheduleDragCount >= 2 ? "bad" : scheduleDragCount === 1 ? "warn" : "good"}
          onClick={onOpen}
        />
      </div>
    </div>
  );
}
