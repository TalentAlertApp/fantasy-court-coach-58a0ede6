import { RefreshCcw, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STEP_LABELS: Record<string, string> = {
  STARTING: "Starting…",
  FETCHING_PERGAME: "Fetching player stats…",
  FETCHING_GAME_LOGS: "Fetching game logs…",
  UPSERTING_PLAYERS: "Saving players…",
  COMPUTING_VALUES: "Computing values…",
  UPSERTING_GAME_LOGS: "Saving game logs…",
  FETCHING_LAST_GAME: "Fetching last games…",
  FETCHING_TEAM_SCORES: "Fetching scores…",
  UPSERTING_GAMES: "Saving games…",
  UPSERTING_LAST_GAMES: "Saving last games…",
  SHEET_FALLBACK: "Using Google Sheet…",
  DONE: "Done!",
};

interface SplitSyncButtonProps {
  isSyncing: boolean;
  syncStep: string | null;
  onQuickSync: () => void;
  onFullSync: () => void;
}

export default function SplitSyncButton({
  isSyncing,
  syncStep,
  onQuickSync,
  onFullSync,
}: SplitSyncButtonProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-stretch">
        {/* Main button — Quick Sync */}
        <button
          onClick={onQuickSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 bg-accent text-accent-foreground px-3 py-1.5 rounded-l text-xs font-heading font-bold uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing…" : "Quick Sync"}
        </button>

        {/* Dropdown trigger */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={isSyncing}
              className="flex items-center bg-accent text-accent-foreground px-1.5 py-1.5 rounded-r border-l border-accent-foreground/20 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            <DropdownMenuItem onClick={onFullSync} disabled={isSyncing}>
              <RefreshCcw className="h-3.5 w-3.5 mr-2" />
              Full Sync
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isSyncing && syncStep && (
        <span className="text-[10px] text-white/60 mt-0.5 whitespace-nowrap">
          {STEP_LABELS[syncStep] ?? syncStep}
        </span>
      )}
    </div>
  );
}
