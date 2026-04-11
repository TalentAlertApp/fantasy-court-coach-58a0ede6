import { NavLink, Outlet } from "react-router-dom";
import { ClipboardList, ArrowLeftRight, Calendar, Shield, Shirt, Gauge, Sun, Moon, ChevronLeft, ChevronRight, Basketball } from "lucide-react";
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
function shouldAutoSync(): boolean {
  const LS_KEY = "nba_last_auto_sync_date";
  const lastDate = localStorage.getItem(LS_KEY);
  const now = new Date();
  const lisbonStr = now.toLocaleString("en-CA", { timeZone: "Europe/Lisbon", hour12: false });
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
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(() =>
    localStorage.getItem("nba_theme") === "dark" ||
    (!localStorage.getItem("nba_theme") && window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Apply dark class to <html>
  useEffect(() => {
    const html = document.documentElement;
    if (dark) {
      html.classList.add("dark");
      localStorage.setItem("nba_theme", "dark");
    } else {
      html.classList.remove("dark");
      localStorage.setItem("nba_theme", "light");
    }
  }, [dark]);

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

  useEffect(() => {
    localStorage.setItem("nba_auto_refresh", String(autoRefresh));
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (!isSyncing && shouldAutoSync()) handleSync();
    }, 60_000);
    if (!isSyncing && shouldAutoSync()) handleSync();
    return () => clearInterval(interval);
  }, [autoRefresh, isSyncing, handleSync]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return (
    <div className="app-shell">
      {/* ── LEFT SIDEBAR ─────────────────────────────── */}
      <aside className={`sidebar${collapsed ? " collapsed" : ""} animate-slide-in-left`}>
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
               style={{ background: "hsl(var(--sidebar-primary))", color: "hsl(var(--sidebar-primary-foreground))" }}>
            🏀
          </div>
          {!collapsed && (
            <span className="text-sm font-heading font-bold uppercase tracking-widest truncate"
                  style={{ color: "hsl(var(--sidebar-foreground))" }}>
              NBA Fantasy
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 flex flex-col gap-0.5 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `nav-item${isActive ? " active" : ""}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom controls */}
        <div className="flex flex-col gap-2 p-3 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
          {/* Theme toggle */}
          <button
            onClick={() => setDark(d => !d)}
            className="theme-toggle w-full"
            title={dark ? "Switch to Light" : "Switch to Dark"}
          >
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            {!collapsed && (
              <span className="ml-2 text-[10px] uppercase tracking-wider">
                {dark ? "Light" : "Dark"}
              </span>
            )}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="theme-toggle w-full"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5" />
              : <ChevronLeft className="h-3.5 w-3.5" />}
            {!collapsed && (
              <span className="ml-2 text-[10px] uppercase tracking-wider">Collapse</span>
            )}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────── */}
      <div className="main-content">
        {/* Top bar */}
        <header className="topbar">
          <div className="flex items-center gap-3">
            {/* Sync Status */}
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
            {/* 6AM auto-refresh */}
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-[10px] opacity-50 uppercase">6AM</span>
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                className="scale-75"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <SplitSyncButton
              isSyncing={isSyncing}
              syncStep={syncStep}
              onSync={handleSync}
            />
            <TeamSwitcher />
            <HowToPlayModal />
          </div>
        </header>

        {/* Page */}
        <main className="page-scroll">
          <div className="animate-fade-in w-full h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
