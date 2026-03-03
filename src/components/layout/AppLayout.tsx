import { NavLink, Outlet } from "react-router-dom";
import { Home, Users, BarChart3, ArrowLeftRight, Calendar, Bot, RefreshCcw } from "lucide-react";
import TeamSwitcher from "@/components/TeamSwitcher";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { triggerSync, fetchSyncStatus } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

const navItems = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/roster", label: "Edit Line-up", icon: Users },
  { to: "/stats", label: "Stats", icon: BarChart3 },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/players", label: "Waiver Wire", icon: Users },
  { to: "/schedule", label: "Schedule", icon: Calendar },
  { to: "/ai", label: "AI Hub", icon: Bot },
];

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

export default function AppLayout() {
  const queryClient = useQueryClient();
  const [autoRefresh, setAutoRefresh] = useState(() =>
    localStorage.getItem("nba_auto_refresh") === "true"
  );

  // Poll sync status every 60s
  const { data: syncStatus } = useQuery({
    queryKey: ["sync-status"],
    queryFn: () => fetchSyncStatus(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: () => triggerSync({ type: "FULL", force: false }),
    onSuccess: (data) => {
      const players = data.counts?.players ?? 0;
      const lastGames = data.counts?.last_games ?? 0;
      toast.success(`Synced: ${players} players, ${lastGames} last games`);
      // Invalidate all data queries
      queryClient.invalidateQueries({ queryKey: ["players"] });
      queryClient.invalidateQueries({ queryKey: ["roster-current"] });
      queryClient.invalidateQueries({ queryKey: ["last-game"] });
      queryClient.invalidateQueries({ queryKey: ["sync-status"] });
    },
    onError: (err: any) => {
      toast.error(`Sync failed: ${err?.message ?? "Unknown error"}`);
    },
  });

  // Auto-refresh interval
  useEffect(() => {
    localStorage.setItem("nba_auto_refresh", String(autoRefresh));
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (!syncMutation.isPending) {
        syncMutation.mutate();
      }
    }, 30 * 60 * 1000); // 30 minutes
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleSync = useCallback(() => {
    if (!syncMutation.isPending) {
      syncMutation.mutate();
    }
  }, [syncMutation]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header — deep navy */}
      <header className="bg-nba-navy text-white">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between">
          <h1 className="text-xl font-heading font-bold tracking-widest">🏀 NBA FANTASY MANAGER</h1>

          {/* Sync controls */}
          <div className="flex items-center gap-3">
            {/* Last sync label */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/70">
              <span>Sync: {formatTimeAgo(syncStatus?.last_success_at ?? null)}</span>
              {syncStatus?.is_stale && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 uppercase font-bold">
                  Stale
                </Badge>
              )}
            </div>

            {/* Auto-refresh toggle */}
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-[10px] text-white/50 uppercase">Auto</span>
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                className="scale-75"
              />
            </div>

            {/* Sync button */}
            <button
              onClick={handleSync}
              disabled={syncMutation.isPending}
              className="flex items-center gap-1.5 bg-accent text-accent-foreground px-3 py-1.5 rounded text-xs font-heading font-bold uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
              {syncMutation.isPending ? "Syncing…" : "Sync"}
            </button>

            <TeamSwitcher />
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
