import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Database, Loader2, CalendarDays, Trophy, Users, BarChart3, RefreshCw, Shield, ListChecks,
  DollarSign, Tv2,
} from "lucide-react";
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
  games_counted?: number;
  teams_ranked?: number;
  notes?: string;
  errors?: string[];
  skipped_players?: Array<{ id: number; name: string }>;
  aliased_players?: Array<{ from: number; to: number; name: string }>;
  stubs_created?: Array<{ id: number; name: string; team: string }>;
  results?: Record<string, SyncResult>;
}

const TAB_LABELS: Record<string, string> = {
  teams: "DB_Teams",
  schedule: "Schedule",
  "game-data": "Player_Games_byGameday_data",
  "advanced-stats": "Players_AdvStats_Season_Accum",
  players: "DB_Players",
};

const adminSecret = () =>
  (typeof window !== "undefined" ? localStorage.getItem("nba_admin_secret") : "") ?? "";

export default function EuroleagueSheetSyncPanel() {
  const [busyMode, setBusyMode] = useState<string | null>(null);
  const [inspect, setInspect] = useState<InspectResult | null>(null);
  const [results, setResults] = useState<Record<string, SyncResult>>({});
  const [salaryBusy, setSalaryBusy] = useState(false);
  const [salaryResult, setSalaryResult] = useState<{
    updated: number; failed: number; min: number; max: number;
    source_breakdown?: { computed: number; placeholder: number };
  } | null>(null);
  const [recapBusy, setRecapBusy] = useState(false);
  const [recapResult, setRecapResult] = useState<{ processed: number; found: number; remaining: number } | null>(null);

  const runRecapLookup = async () => {
    setRecapBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("youtube-recap-lookup", {
        body: null,
        headers: { "x-admin-secret": adminSecret() },
        method: "GET" as any,
      } as any);
      // The function reads ?league=euroleague from query params, but invoke()
      // doesn't pass them — fall back to fetch.
      const url = `https://jtewuekavaujgnynmpaq.supabase.co/functions/v1/youtube-recap-lookup?league=euroleague&limit=100`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error?.message ?? "Unknown error");
      setRecapResult(json.data);
      toast.success(`Recap lookup: ${json.data.found} found / ${json.data.processed} processed`);
      void data; void error;
    } catch (e) {
      toast.error(`Recap lookup failed: ${(e as Error).message}`);
    } finally {
      setRecapBusy(false);
    }
  };

  const runSalary = async () => {
    setSalaryBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("euroleague-salary-recalc", {
        headers: { "x-admin-secret": adminSecret() },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error?.message ?? "Unknown error");
      setSalaryResult(data.data);
      toast.success(`Recalculated ${data.data.updated} EuroLeague salaries`);
    } catch (e) {
      toast.error(`Salary recalc failed: ${(e as Error).message}`);
    } finally {
      setSalaryBusy(false);
    }
  };

  const run = async (mode: string, label: string) => {
    setBusyMode(mode);
    try {
      const { data, error } = await supabase.functions.invoke("euroleague-sheet-sync", {
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
        <h3 className="font-heading font-bold text-lg uppercase">EuroLeague Google Sheets Sync</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Manual, on-demand pull from the EuroLeague spreadsheet (service-account auth). All writes are
        scoped to the EuroLeague league — NBA and WNBA data is never touched. Player{" "}
        <strong>salary ($) is never overwritten</strong> by the sheet.
      </p>

      <div className="flex flex-wrap gap-2">
        <Btn mode="inspect"        label="Inspect Sheet"        icon={Database} />
        <Btn mode="teams"          label="Sync Teams"           icon={Shield} />
        <Btn mode="players"        label="Sync Player Database" icon={Users} />
        <Btn mode="schedule"       label="Sync Schedule"        icon={CalendarDays} />
        <Btn mode="game-data"      label="Sync Game Data"       icon={Trophy} />
        <Btn mode="advanced-stats" label="Sync Advanced Stats"  icon={BarChart3} />
        <Btn mode="standings"      label="Sync Standings"       icon={ListChecks} />
        <Btn mode="all"            label="Sync ALL"             icon={RefreshCw} primary />
        <Button
          onClick={runSalary}
          disabled={busyMode !== null || salaryBusy}
          variant="secondary"
          size="sm"
        >
          {salaryBusy
            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            : <DollarSign className="h-4 w-4 mr-2" />}
          Recalculate Salaries
        </Button>
        <Button
          onClick={runRecapLookup}
          disabled={busyMode !== null || recapBusy}
          variant="secondary"
          size="sm"
        >
          {recapBusy
            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            : <Tv2 className="h-4 w-4 mr-2" />}
          Find YouTube Recaps
        </Button>
      </div>

      {recapResult && (
        <div className="border rounded-md p-2 text-xs flex flex-wrap gap-x-4 gap-y-1 bg-muted/30">
          <span className="font-semibold">recap lookup</span>
          <span>processed: <b>{recapResult.processed}</b></span>
          <span>found: <b>{recapResult.found}</b></span>
          <span>remaining: <b>{recapResult.remaining}</b></span>
        </div>
      )}

      {salaryResult && (
        <div className="border rounded-md p-2 text-xs flex flex-wrap gap-x-4 gap-y-1 bg-muted/30">
          <span className="font-semibold">salary recalc</span>
          <span>updated: <b>{salaryResult.updated}</b></span>
          {salaryResult.failed > 0 && <span className="text-destructive">failed: {salaryResult.failed}</span>}
          <span>range: <b>${salaryResult.min}M – ${salaryResult.max}M</b></span>
          {salaryResult.source_breakdown && (
            <span>
              computed: <b>{salaryResult.source_breakdown.computed}</b> · placeholder: <b>{salaryResult.source_breakdown.placeholder}</b>
            </span>
          )}
        </div>
      )}

      {/* Per-mode sync results */}
      {Object.entries(results).filter(([k]) => k !== "all").length > 0 && (
        <div className="space-y-2">
          {Object.entries(results)
            .filter(([k]) => k !== "all")
            .map(([key, r]) => (
              <div key={key} className="border rounded-md p-2 text-xs flex flex-wrap gap-x-4 gap-y-1">
                <span className="font-semibold">{key}</span>
                {r.tab && <span className="text-muted-foreground">{r.tab}</span>}
                {r.rows_read !== undefined && <span>read: <b>{r.rows_read}</b></span>}
                {r.upserted !== undefined && <span>upserted: <b>{r.upserted}</b></span>}
                {r.skipped !== undefined && <span>skipped: <b>{r.skipped}</b></span>}
                {r.nulled_out !== undefined && <span>nulled: <b>{r.nulled_out}</b></span>}
                {r.games_upserted !== undefined && <span>games: <b>{r.games_upserted}</b></span>}
                {r.last_game_updated !== undefined && <span>last_game: <b>{r.last_game_updated}</b></span>}
                {r.players_aggregated !== undefined && <span>aggregated: <b>{r.players_aggregated}</b></span>}
                {r.games_counted !== undefined && <span>final games: <b>{r.games_counted}</b></span>}
                {r.teams_ranked !== undefined && <span>teams ranked: <b>{r.teams_ranked}</b></span>}
                <span className="text-muted-foreground">{r.elapsed_ms}ms</span>
                {r.notes && <span className="text-muted-foreground italic">{r.notes}</span>}
                {r.errors && r.errors.length > 0 && (
                  <span className="text-destructive">errors: {r.errors.length}</span>
                )}
                {r.skipped_players && r.skipped_players.length > 0 && (
                  <details className="basis-full mt-1">
                    <summary className="cursor-pointer text-amber-600 dark:text-amber-400">
                      {r.skipped_players.length} player{r.skipped_players.length === 1 ? "" : "s"} skipped (not found in DB_Players) — click to expand
                    </summary>
                    <ul className="mt-1 ml-4 list-disc text-muted-foreground space-y-0.5">
                      {r.skipped_players.map((p, i) => (
                        <li key={`${p.id}-${i}`}>
                          <code className="font-mono">{p.id}</code> — {p.name || "(no name)"}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {r.aliased_players && r.aliased_players.length > 0 && (
                  <details className="basis-full mt-1">
                    <summary className="cursor-pointer text-blue-600 dark:text-blue-400">
                      {r.aliased_players.length} player id{r.aliased_players.length === 1 ? "" : "s"} aliased to canonical DB_Players row — click to expand
                    </summary>
                    <ul className="mt-1 ml-4 list-disc text-muted-foreground space-y-0.5">
                      {r.aliased_players.map((p, i) => (
                        <li key={`${p.from}-${i}`}>
                          <code className="font-mono">{p.from}</code> → <code className="font-mono">{p.to}</code> — {p.name}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {r.stubs_created && r.stubs_created.length > 0 && (
                  <details className="basis-full mt-1">
                    <summary className="cursor-pointer text-emerald-600 dark:text-emerald-400">
                      {r.stubs_created.length} stub player{r.stubs_created.length === 1 ? "" : "s"} auto-created (salary=0) — click to expand
                    </summary>
                    <ul className="mt-1 ml-4 list-disc text-muted-foreground space-y-0.5">
                      {r.stubs_created.map((p, i) => (
                        <li key={`${p.id}-${i}`}>
                          <code className="font-mono">{p.id}</code> — {p.name} ({p.team})
                        </li>
                      ))}
                    </ul>
                  </details>
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
                  {key} <span className="text-muted-foreground font-normal">→ {TAB_LABELS[key] ?? key}</span>
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
