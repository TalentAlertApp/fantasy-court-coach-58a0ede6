import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SyncStatusCardProps {
  lastSuccessAt: string | null;
  source: string | null | undefined;
  durationMs: number | null | undefined;
  playerCount: number;
  errorCount: number;
  errors: string[];
  isStale: boolean;
  lastType: string | null;
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${Math.round(ms / 1000)}s`;
}

export default function SyncStatusCard({
  lastSuccessAt,
  source,
  durationMs,
  playerCount,
  errorCount,
  errors,
  isStale,
  lastType,
}: SyncStatusCardProps) {
  const sourceLabel = source === "sheet" ? "Sheet" : source === "nba" ? "NBA" : source ?? "—";
  const isSheet = source === "sheet";

  return (
    <div className="hidden sm:flex flex-col gap-0.5 bg-white/10 rounded px-2.5 py-1 text-[10px] leading-tight min-w-[140px]">
      {/* Row 1: source, duration, time ago */}
      <div className="flex items-center gap-1.5 text-white/90">
        <Badge
          variant="outline"
          className={`text-[9px] px-1 py-0 h-3.5 border-0 font-bold uppercase tracking-wider ${
            isSheet
              ? "bg-amber-500/80 text-white"
              : "bg-emerald-500/80 text-white"
          }`}
        >
          {sourceLabel}
        </Badge>
        <span className="text-white/60">{formatDuration(durationMs)}</span>
        <span className="text-white/60">·</span>
        <span className="text-white/80 font-medium">{formatTimeAgo(lastSuccessAt)}</span>
        {isStale && (
          <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5 uppercase font-bold">
            Stale
          </Badge>
        )}
      </div>
      {/* Row 2: player count, type, errors */}
      <div className="flex items-center gap-1.5 text-white/60">
        <span>{playerCount} players</span>
        {lastType && (
          <>
            <span>·</span>
            <span className="uppercase">{lastType === "LAST_GAME" ? "Quick" : lastType}</span>
          </>
        )}
        <span>·</span>
        {errorCount > 0 ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5 cursor-help">
                  {errorCount} err{errorCount !== 1 ? "s" : ""}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                <ul className="list-disc pl-3 space-y-0.5">
                  {errors.slice(0, 5).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <span className="text-emerald-400/80">0 errors</span>
        )}
      </div>
    </div>
  );
}
