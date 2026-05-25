import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Database, Loader2, CalendarDays, Trophy, Users, BarChart3, RefreshCw,
  Clock, Save, Youtube, Play,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TabInspect {
  headers: string[];
  samples: string[][];
  error?: string;
}
interface InspectResult {
  sheet_id: string;
  tabs: Record<string, TabInspect>;
}
interface SyncResult {
  mode: string;
  elapsed_ms: number;
  tab?: string;
  rows_read?: number;
  upserted?: number;
  skipped?: number;
  nulled_out?: number;
  games_upserted?: number;
  last_game_updated?: number;
  players_aggregated?: number;
  errors?: string[];
  results?: Record<string, SyncResult>;
}

const TAB_LABELS: Record<string, string> = {
  schedule: "Schedule",
  "game-data": "Player_Games_byGameday_data",
  "advanced-stats": "Players_AdvStats_Season_Accum",
  players: "DB_Players",
};

const adminSecret = () =>
  (typeof window !== "undefined" ? localStorage.getItem("nba_admin_secret") : "") ?? "";

interface ScheduleRow {
  job_key: "sync3" | "all" | "salary-auto";
  enabled: boolean;
  run_time_lisbon: string;
  include_recaps: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
}

const JOB_LABELS: Record<ScheduleRow["job_key"], string> = {
  sync3: "Sync Schedule + Games + Advanced",
  all: "Sync ALL",
  "salary-auto": "Salary Auto-Adjust (NBA + WNBA)",
};

export default function WnbaSheetSyncPanel() {
  const queryClient = useQueryClient();
  const [busyMode, setBusyMode] = useState<string | null>(null);
  const [inspect, setInspect] = useState<InspectResult | null>(null);
  const [results, setResults] = useState<Record<string, SyncResult>>({});
  const [schedules, setSchedules] = useState<Record<string, ScheduleRow>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const loadSchedules = async () => {
    const { data, error } = await supabase.functions.invoke("commissioner-schedule-config", {
      method: "GET",
      headers: { "x-admin-secret": adminSecret() },
    });
    if (error || !data?.ok) return;
    const map: Record<string, ScheduleRow> = {};
    for (const r of (data.data?.schedules ?? []) as ScheduleRow[]) map[r.job_key] = r;
    setSchedules(map);
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const updateSchedule = (key: ScheduleRow["job_key"], patch: Partial<ScheduleRow>) => {
    setSchedules((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const saveSchedule = async (key: ScheduleRow["job_key"]) => {
    const row = schedules[key];
    if (!row) return;
    if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(row.run_time_lisbon)) {
      toast.error("Time must be HH:MM (24h)");
      return;
    }
    setSavingKey(key);
    try {
      const { data, error } = await supabase.functions.invoke("commissioner-schedule-config", {
        method: "POST",
        headers: { "x-admin-secret": adminSecret() },
        body: {
          job_key: key,
          enabled: row.enabled,
          run_time_lisbon: row.run_time_lisbon,
          include_recaps: row.include_recaps,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error?.message ?? "Failed");
      toast.success(`Saved schedule for ${JOB_LABELS[key]}`);
      await loadSchedules();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingKey(null);
    }
  };

  const runScheduleNow = async (key: ScheduleRow["job_key"]) => {
    setSavingKey(`run-${key}`);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/commissioner-schedule-tick?force=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret(),
        },
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      toast.success(`Triggered ${JOB_LABELS[key]} now`);
      await loadSchedules();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingKey(null);
    }
  };

  const invalidateScheduleCaches = () => {
    queryClient.invalidateQueries({ queryKey: ["schedule"] });
    queryClient.invalidateQueries({ queryKey: ["wnba-schedule"] });
    queryClient.invalidateQueries({ queryKey: ["games"] });
    queryClient.invalidateQueries({ queryKey: ["game-boxscore"] });
    queryClient.invalidateQueries({ queryKey: ["gameday"] });
    queryClient.invalidateQueries({ queryKey: ["scoring"] });
  };

  const run = async (mode: string, label: string) => {
    setBusyMode(mode);
    try {
      // Combined Sync 3: schedule + game-data + advanced-stats sequentially.
      if (mode === "sync3") {
        const steps: Array<{ m: string; l: string }> = [
          { m: "schedule", l: "Sync Schedule" },
          { m: "game-data", l: "Sync Game Data" },
          { m: "advanced-stats", l: "Sync Advanced Stats" },
        ];
        for (const s of steps) {
          const { data, error } = await supabase.functions.invoke("wnba-sheet-sync", {
            body: { mode: s.m },
            headers: { "x-admin-secret": adminSecret() },
          });
          if (error) throw new Error(`${s.l}: ${error.message ?? "error"}`);
          if (!data?.ok) throw new Error(`${s.l}: ${data?.error?.message ?? "failed"}`);
          setResults((prev) => ({ ...prev, [s.m]: data.data as SyncResult }));
        }
        toast.success("Schedule + Game Data + Advanced Stats synced");
        invalidateScheduleCaches();
        return;
      }
      const { data, error } = await supabase.functions.invoke("wnba-sheet-sync", {
        body: { mode },
        headers: { "x-admin-secret": adminSecret() },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error?.message ?? "Unknown error");
      if (mode === "inspect") {
        setInspect(data.data as InspectResult);
      } else if (mode === "all") {
        const all = data.data as SyncResult;
        if (all.results) setResults((prev) => ({ ...prev, ...all.results }));
        setResults((prev) => ({ ...prev, all }));
      } else {
        setResults((prev) => ({ ...prev, [mode]: data.data as SyncResult }));
      }
      toast.success(`${label} done`);
      if (mode === "schedule" || mode === "game-data" || mode === "all") {
        invalidateScheduleCaches();
      }
    } catch (e) {
      toast.error(`${label} failed: ${(e as Error).message}`);
    } finally {
      setBusyMode(null);
    }
  };

  const Btn = ({ mode, label, icon: Icon, primary }: {
    mode: string; label: string; icon: typeof Database; primary?: boolean;
  }) => (
    <Button
      onClick={() => run(mode, label)}
      disabled={busyMode !== null}
      variant={primary ? "default" : "secondary"}
      size="sm"
    >
      {busyMode === mode
        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        : <Icon className="h-4 w-4 mr-2" />}
      {label}
    </Button>
  );

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        <h3 className="font-heading font-bold text-lg uppercase">WNBA Google Sheets Sync</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Manual, on-demand pull from the WNBA spreadsheet (service-account auth). All writes are
        scoped to the WNBA league. Player <strong>salary ($) is never overwritten</strong> by the
        sheet — managed in-app on request.
      </p>

      <div className="flex flex-wrap gap-2">
        <Btn mode="inspect"        label="Inspect Sheet"       icon={Database} />
        <Btn mode="players"        label="Sync Player Database" icon={Users} />
        <Btn mode="schedule"       label="Sync Schedule"        icon={CalendarDays} />
        <Btn mode="game-data"      label="Sync Game Data"       icon={Trophy} />
        <Btn mode="advanced-stats" label="Sync Advanced Stats"  icon={BarChart3} />
        <Btn mode="sync3"          label="Sync Schedule + Games + Advanced" icon={RefreshCw} primary />
        <Btn mode="all"            label="Sync ALL"             icon={RefreshCw} primary />
      </div>

      {/* Daily scheduled runs */}
      <div className="border rounded-md p-3 space-y-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm uppercase">Scheduled daily runs (Europe/Lisbon)</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          Runs automatically at the chosen local time. Toggle "Include YouTube Recaps"
          to also run <code>youtube-recap-lookup</code> right after.
        </p>
        {(["sync3", "all"] as const).map((key) => {
          const row = schedules[key];
          if (!row) return null;
          return (
            <div key={key} className="border rounded-md p-3 space-y-2 bg-background">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-semibold text-sm">{JOB_LABELS[key]}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {row.last_run_at && (
                    <span>
                      Last run: <b className={row.last_status === "error" ? "text-destructive" : "text-foreground"}>
                        {new Date(row.last_run_at).toLocaleString()}
                      </b>{" "}({row.last_status})
                    </span>
                  )}
                </div>
              </div>
              {row.last_error && (
                <div className="text-xs text-destructive">Error: {row.last_error}</div>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={row.enabled}
                    onCheckedChange={(v) => updateSchedule(key, { enabled: v })}
                    id={`enabled-${key}`}
                  />
                  <Label htmlFor={`enabled-${key}`} className="text-xs">Enabled</Label>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`time-${key}`} className="text-xs">Run time (HH:MM)</Label>
                  <Input
                    id={`time-${key}`}
                    type="time"
                    value={row.run_time_lisbon}
                    onChange={(e) => updateSchedule(key, { run_time_lisbon: e.target.value })}
                    className="w-28 h-8"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={row.include_recaps}
                    onCheckedChange={(v) => updateSchedule(key, { include_recaps: v })}
                    id={`recaps-${key}`}
                  />
                  <Label htmlFor={`recaps-${key}`} className="text-xs flex items-center gap-1">
                    <Youtube className="h-3 w-3" /> Include YouTube Recaps
                  </Label>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => saveSchedule(key)}
                  disabled={savingKey !== null}
                >
                  {savingKey === key
                    ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    : <Save className="h-3 w-3 mr-1" />}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => runScheduleNow(key)}
                  disabled={savingKey !== null}
                  title="Run this scheduled job right now (uses the saved 'Include Recaps' setting)"
                >
                  {savingKey === `run-${key}`
                    ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    : <Play className="h-3 w-3 mr-1" />}
                  Run now
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-tab sync results */}
      {Object.entries(results).filter(([k]) => k !== "all").length > 0 && (
        <div className="space-y-2">
          {Object.entries(results)
            .filter(([k]) => k !== "all")
            .map(([key, r]) => (
              <div key={key} className="border rounded-md p-2 text-xs flex flex-wrap gap-x-4 gap-y-1">
                <span className="font-semibold">{key}</span>
                <span className="text-muted-foreground">{r.tab}</span>
                {r.rows_read !== undefined && <span>read: <b>{r.rows_read}</b></span>}
                {r.upserted !== undefined && <span>upserted: <b>{r.upserted}</b></span>}
                {r.skipped !== undefined && <span>skipped: <b>{r.skipped}</b></span>}
                {r.nulled_out !== undefined && <span>nulled: <b>{r.nulled_out}</b></span>}
                {r.games_upserted !== undefined && <span>games: <b>{r.games_upserted}</b></span>}
                {r.last_game_updated !== undefined && <span>last_game: <b>{r.last_game_updated}</b></span>}
                {r.players_aggregated !== undefined && <span>aggregated: <b>{r.players_aggregated}</b></span>}
                <span className="text-muted-foreground">{r.elapsed_ms}ms</span>
                {r.errors && r.errors.length > 0 && (
                  <span className="text-destructive">errors: {r.errors.length}</span>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Inspect result */}
      {inspect && (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Sheet ID: <code>{inspect.sheet_id}</code>
          </div>
          {Object.entries(inspect.tabs).map(([key, info]) => (
            <div key={key} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">
                  {key} <span className="text-muted-foreground font-normal">→ {TAB_LABELS[key]}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {info.headers.length} cols · {info.samples.length} sample rows
                </div>
              </div>
              {info.error && <div className="text-xs text-destructive">Error: {info.error}</div>}
              {!info.error && (
                <div className="overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="border-b">
                        {info.headers.map((h, i) => (
                          <th key={i} className="px-2 py-1 text-left font-mono whitespace-nowrap">
                            {String.fromCharCode(65 + (i % 26))}: {h || <em className="text-muted-foreground">(blank)</em>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {info.samples.map((row, ri) => (
                        <tr key={ri} className="border-b last:border-0">
                          {info.headers.map((_, ci) => (
                            <td key={ci} className="px-2 py-1 whitespace-nowrap text-muted-foreground">
                              {row[ci] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
