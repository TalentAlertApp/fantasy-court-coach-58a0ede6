import { RefreshCcw, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SplitSyncButtonProps {
  isSyncing: boolean;
  syncStep: string | null;
  onSync: (type: "FULL" | "SALARY" | "GAMES" | "SCHEDULE") => void;
}

export default function SplitSyncButton({
  isSyncing,
  syncStep,
  onSync,
}: SplitSyncButtonProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center">
        <button
          onClick={() => onSync("FULL")}
          disabled={isSyncing}
          className="flex items-center gap-1.5 bg-accent text-accent-foreground px-3 py-1.5 rounded-l text-xs font-heading font-bold uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing…" : "Sync"}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={isSyncing}>
            <button className="bg-accent text-accent-foreground px-1.5 py-1.5 rounded-r border-l border-accent-foreground/20 text-xs hover:opacity-90 transition-opacity disabled:opacity-50">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSync("FULL")}>
              Full Sync (All)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSync("SALARY")}>
              Sync Salaries
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSync("GAMES")}>
              Sync Games
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSync("SCHEDULE")}>
              Sync Schedule
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isSyncing && syncStep && (
        <span className="text-[10px] text-white/60 mt-0.5 whitespace-nowrap">
          {syncStep}
        </span>
      )}
    </div>
  );
}
