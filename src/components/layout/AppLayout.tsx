import { NavLink, Outlet } from "react-router-dom";
import { ClipboardList, ArrowLeftRight, Calendar, Shield, Shirt, Gauge } from "lucide-react";
import TeamSwitcher from "@/components/TeamSwitcher";
import HowToPlayModal from "@/components/HowToPlayModal";
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { triggerSync, fetchSyncStatus } from "@/lib/api";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import SyncStatusCard from "@/components/layout/SyncStatusCard";
import SplitSyncButton from "@/components/layout/SplitSyncButton";

const navItems = [
  { to: "/", label: "My Roster", icon: ClipboardList, end: true },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/teams", label: "Teams", icon: Shirt },
  { to: "/schedule", label: "Schedule", icon: Calendar },
  { to: "/advanced", label: "Advanced", icon: Gauge },
  { to: "/commissioner", label: "Commissioner", icon: Shield },
];

/** Check if now is past 6:00 AM Lisbon time and we haven't synced today */

/** Check if now is past 6:00 AM Lisbon time and we haven't synced today */
function shouldAutoSync(): boolean {
  const LS_KEY = "nba_last_auto_sync_date";
  const lastDate = localStorage.getItem(LS_KEY);
  const now = new Date();
  // Get Lisbon date/time
  const lisbonStr = now.toLocaleString("en-CA", { timeZone: "Europe/Lisbon", hour12: false });
  // Format: "YYYY-MM-DD, HH:MM:SS"
  const [datePart, timePart] = lisbonStr.split(", ");
  const hour = parseInt(timePart?.split(":")[0] ?? "0", 10);
  if (hour >= 6 && datePart !== lastDate) {
    localStorage.setItem(LS_KEY, datePart);
    return true;
  }
  return false;
}

export default function AppLayout() {
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(() =>
    localStorage.getItem("nba_auto_refresh") === "true"
  );
  const [syncStep, setSyncStep] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll sync status every 60s
  const { data: syncStatus } = useQuery({
    queryKey: ["sync-status"],
    queryFn: () => fetchSyncStatus(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const [isSyncingFlag, setIsSyncingFlag] = useState(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["players"] });
    queryClient.invalidateQueries({ queryKey: ["roster-current"] });
    queryClient.invalidateQueries({ queryKey: ["last-game"] });
    queryClient.invalidateQueries({ queryKey: ["sync-status"] });
  }, [queryClient]);

  const startPolling = useCallback((runId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const status = await fetchSyncStatus(runId);
        const step = (status as any).step ?? null;
        setSyncStep(step);
        if (status.status === "SUCCESS" || status.status === "PARTIAL" || status.status === "FAILED") {
          stopPolling();
          const counts = (status as any).counts ?? {};
          toast.success(`Synced: ${counts.players ?? 0} players, ${counts.last_games ?? 0} last games`);
          setSyncStep(null);
          setIsSyncingFlag(false);
          invalidateAll();
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
  }, [stopPolling, invalidateAll]);

  const handleSync = useCallback(async (type: "FULL" | "SALARY" | "GAMES" | "SCHEDULE" = "FULL") => {
    if (isSyncingFlag) return;
    setIsSyncingFlag(true);
    setSyncStep(`Syncing ${type.toLowerCase()}…`);
    try {
      const result = await triggerSync({ type });
      if (result.run_id && result.status === "RUNNING") {
        startPolling(result.run_id);
      } else {
        const counts = result.counts ?? {};
        const parts: string[] = [];
        if (counts.games) parts.push(`${counts.games} games`);
        if (counts.game_logs) parts.push(`${counts.game_logs} logs`);
        if (counts.salary_updated) parts.push(`${counts.salary_updated} salaries`);
        if (counts.schedule_games) parts.push(`${counts.schedule_games} scheduled`);
        if (counts.players_updated) parts.push(`${counts.players_updated} players updated`);
        toast.success(`Synced: ${parts.join(", ") || "done"}`);
        setSyncStep(null);
        setIsSyncingFlag(false);
        invalidateAll();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Sync failed: ${msg}`);
      setSyncStep(null);
      setIsSyncingFlag(false);
    }
  }, [isSyncingFlag, startPolling, invalidateAll]);

  const isSyncing = isSyncingFlag;

  // Daily 6AM Lisbon auto-refresh
  useEffect(() => {
    localStorage.setItem("nba_auto_refresh", String(autoRefresh));
    if (!autoRefresh) return;
    // Check every 60s if we should auto-sync
    const interval = setInterval(() => {
      if (!isSyncing && shouldAutoSync()) {
        handleSync();
      }
    }, 60_000);
    // Also check immediately
    if (!isSyncing && shouldAutoSync()) {
      handleSync();
    }
    return () => clearInterval(interval);
  }, [autoRefresh, isSyncing, handleSync]);

  // Cleanup polling on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header — deep navy */}
      <header className="bg-nba-navy text-white">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between">
          <h1 className="text-xl font-heading font-bold tracking-widest">🏀 NBA FANTASY MANAGER</h1>

          {/* Sync controls */}
          <div className="flex items-center gap-3">
            {/* Sync Status Card */}
            <SyncStatusCard
              lastSuccessAt={syncStatus?.last_success_at ?? null}
              source={syncStatus?.source}
              durationMs={syncStatus?.duration_ms}
              playerCount={syncStatus?.counts?.players ?? 0}
              errorCount={syncStatus?.error_count ?? 0}
              errors={syncStatus?.errors ?? []}
              isStale={syncStatus?.is_stale ?? false}
              lastType={syncStatus?.last_type ?? null}
            />

            {/* Auto-refresh toggle — daily 6AM */}
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-[10px] text-white/50 uppercase">6AM</span>
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                className="scale-75"
              />
            </div>

            {/* Sync Button */}
            <SplitSyncButton
              isSyncing={isSyncing}
              syncStep={syncStep}
              onSync={handleSync}
            />

            <TeamSwitcher />
            <HowToPlayModal />
          </div>
        </div>
      </header>

      {/* Navigation — white bar with yellow active indicator */}
      <nav className="bg-card border-b sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2.5 text-sm font-heading font-semibold uppercase tracking-wide whitespace-nowrap transition-colors border-b-[3px] ${
                    isActive
                      ? "border-accent text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 container mx-auto px-4 py-4">
        <Outlet />
      </main>
    </div>
  );
}
