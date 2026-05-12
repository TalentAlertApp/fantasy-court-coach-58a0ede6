import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Database, Loader2, CalendarDays, Trophy, Users, BarChart3, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export default function WnbaSheetSyncPanel() {
  const [busyMode, setBusyMode] = useState<string | null>(null);
  const [inspect, setInspect] = useState<InspectResult | null>(null);
  const [results, setResults] = useState<Record<string, SyncResult>>({});

  const run = async (mode: string, label: string) => {
    setBusyMode(mode);
    try {
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
        <Btn mode="all"            label="Sync ALL"             icon={RefreshCw} primary />
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
