import { Button } from "@/components/ui/button";
import BallersIQBrand from "@/components/ballers-iq/BallersIQBrand";
import { Users, Crown, Flame, CalendarX, Tv2 } from "lucide-react";

export interface GameNightSummary {
  activePlayers: number;
  totalRoster: number;
  captainStatus: { name: string; playing: boolean } | null;
  topGame: { label: string; score: number } | null;
  noGameWarning: { count: number; names: string[] } | null;
  recapReadyCount: number;
}

function Cell({
  icon: Icon,
  label,
  value,
  tone = "default",
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "default" | "good" | "warn" | "bad";
  hint?: string;
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-500"
      : tone === "warn"
        ? "text-amber-500"
        : tone === "bad"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="flex items-center gap-1.5 min-w-0" title={hint}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${toneClass}`} />
      <div className="min-w-0 leading-tight">
        <p className="text-[8px] font-heading font-bold uppercase tracking-widest text-muted-foreground leading-none">
          {label}
        </p>
        <p className={`text-[11px] font-heading font-bold uppercase truncate leading-tight ${toneClass}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

export default function BallersIQGameNightSummary({
  summary,
  onOpen,
}: {
  summary: GameNightSummary;
  onOpen: () => void;
}) {
  const cap = summary.captainStatus;
  const noGame = summary.noGameWarning;
  return (
    <div className="rounded-xl border border-amber-400/30 bg-card/80 backdrop-blur-sm px-3 py-2 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 shrink-0">
        <BallersIQBrand variant="emblem" forceTheme="light" transparent className="!h-4 !w-4 dark:hidden" />
        <BallersIQBrand variant="emblem" forceTheme="dark" transparent className="!h-4 !w-4 hidden dark:block" />
        <span className="text-[9px] font-heading font-bold uppercase tracking-widest text-amber-500">
          Game Night
        </span>
      </div>
      <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-1.5">
        <Cell
          icon={Users}
          label="Active"
          value={`${summary.activePlayers}/${summary.totalRoster}`}
          tone={summary.activePlayers >= summary.totalRoster - 2 ? "good" : summary.activePlayers >= 5 ? "default" : "warn"}
        />
        <Cell
          icon={Crown}
          label="Captain"
          value={cap ? (cap.playing ? cap.name : `${cap.name} (out)`) : "—"}
          tone={cap ? (cap.playing ? "good" : "bad") : "default"}
        />
        <Cell
          icon={Flame}
          label="Top Slate"
          value={summary.topGame?.label ?? "—"}
          tone="default"
          hint={summary.topGame ? `Fantasy environment ${summary.topGame.score}` : undefined}
        />
        <Cell
          icon={CalendarX}
          label="No-Game"
          value={noGame && noGame.count > 0 ? `${noGame.count} owned` : "Clear"}
          tone={noGame && noGame.count >= 2 ? "bad" : noGame && noGame.count === 1 ? "warn" : "good"}
          hint={noGame?.names.join(", ")}
        />
        <Cell
          icon={Tv2}
          label="Recap"
          value={summary.recapReadyCount > 0 ? `${summary.recapReadyCount} ready` : "—"}
          tone={summary.recapReadyCount > 0 ? "good" : "default"}
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
