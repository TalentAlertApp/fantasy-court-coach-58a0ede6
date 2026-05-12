import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Database, Loader2 } from "lucide-react";
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

const TAB_LABELS: Record<string, string> = {
  schedule: "Schedule",
  "game-data": "Player_Games_byGameday_data",
  "advanced-stats": "Players_AdvStats_Season_Accum",
  players: "DB_Players",
};

export default function WnbaSheetSyncPanel() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InspectResult | null>(null);

  const runInspect = async () => {
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("wnba-sheet-sync", {
        body: { mode: "inspect" },
        headers: {
          "x-admin-secret": (typeof window !== "undefined"
            ? localStorage.getItem("nba_admin_secret")
            : "") ?? "",
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error?.message ?? "Unknown error");
      setResult(data.data as InspectResult);
      toast.success("WNBA sheet inspected");
    } catch (e) {
      toast.error(`Inspect failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        <h3 className="font-heading font-bold text-lg uppercase">WNBA Google Sheets Sync</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Manual, on-demand pull from the WNBA spreadsheet (service account auth, read-only).
        Step 1: <strong className="text-foreground">Inspect</strong> the four tabs to confirm the
        column layouts. Once verified, per-tab Sync buttons will be wired to the existing
        <code className="mx-1">import-*</code> edge functions with <code>league_code: "wnba"</code>.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={runInspect} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
          Inspect WNBA Sheet
        </Button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Sheet ID: <code>{result.sheet_id}</code>
          </div>
          {Object.entries(result.tabs).map(([key, info]) => (
            <div key={key} className="border rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm">
                  {key} <span className="text-muted-foreground font-normal">→ {TAB_LABELS[key]}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {info.headers.length} cols · {info.samples.length} sample rows
                </div>
              </div>
              {info.error && (
                <div className="text-xs text-destructive">Error: {info.error}</div>
              )}
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
