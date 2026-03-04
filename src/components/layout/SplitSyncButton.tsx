import { RefreshCcw } from "lucide-react";

const STEP_LABELS: Record<string, string> = {
  STARTING: "Starting…",
  FETCHING_PLAYERS: "Fetching players…",
  UPSERTING_PLAYERS: "Saving players…",
  FETCHING_GAMES: "Fetching games…",
  UPSERTING_GAMES: "Saving games…",
  FETCHING_TEAMS_LOOKUP: "Loading teams…",
  FETCHING_SEASON_AVERAGES: "Season averages…",
  UPSERTING_SEASON_STATS: "Saving season stats…",
  FETCHING_GAME_LOGS: "Fetching game logs…",
  UPSERTING_GAME_LOGS: "Saving game logs…",
  COMPUTING_LAST5: "Computing last 5…",
  UPSERTING_LAST_GAMES: "Saving last games…",
  DONE: "Done!",
};

interface SplitSyncButtonProps {
  isSyncing: boolean;
  syncStep: string | null;
  onSync: () => void;
}

export default function SplitSyncButton({
  isSyncing,
  syncStep,
  onSync,
}: SplitSyncButtonProps) {
  return (
    <div className="flex flex-col items-center">
      <button
        onClick={onSync}
        disabled={isSyncing}
        className="flex items-center gap-1.5 bg-accent text-accent-foreground px-3 py-1.5 rounded text-xs font-heading font-bold uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        <RefreshCcw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
        {isSyncing ? "Syncing…" : "Sync"}
      </button>

      {isSyncing && syncStep && (
        <span className="text-[10px] text-white/60 mt-0.5 whitespace-nowrap">
          {STEP_LABELS[syncStep] ?? syncStep}
        </span>
      )}
    </div>
  );
}
