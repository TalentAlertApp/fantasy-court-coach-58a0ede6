import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Loader2, Play, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ScheduleRow {
  job_key: string;
  enabled: boolean;
  run_time_lisbon: string;
  include_recaps: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
}

const adminSecret = () =>
  (typeof window !== "undefined" ? localStorage.getItem("nba_admin_secret") : "") ?? "";

/**
 * Compact in-card scheduler for the `salary-auto` daily job. Drives the same
 * commissioner_sync_schedules row used by the tick endpoint.
 */
export default function SalaryAutoSchedulePanel() {
  const [row, setRow] = useState<ScheduleRow | null>(null);
  const [busy, setBusy] = useState<"save" | "run" | null>(null);

  const load = async () => {
    const { data, error } = await supabase.functions.invoke("commissioner-schedule-config", {
      method: "GET",
      headers: { "x-admin-secret": adminSecret() },
    });
    if (error || !data?.ok) return;
    const found = ((data.data?.schedules ?? []) as ScheduleRow[])
      .find((r) => r.job_key === "salary-auto");
    if (found) setRow(found);
  };

  useEffect(() => { load(); }, []);

  if (!row) {
    return (
      <div className="text-xs text-muted-foreground italic">
        Loading salary-auto schedule…
      </div>
    );
  }

  const update = (patch: Partial<ScheduleRow>) =>
    setRow((prev) => (prev ? { ...prev, ...patch } : prev));

  const save = async () => {
    if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(row.run_time_lisbon)) {
      toast.error("Time must be HH:MM (24h)"); return;
    }
    setBusy("save");
    try {
      const { data, error } = await supabase.functions.invoke("commissioner-schedule-config", {
        method: "POST",
        headers: { "x-admin-secret": adminSecret() },
        body: {
          job_key: "salary-auto",
          enabled: row.enabled,
          run_time_lisbon: row.run_time_lisbon,
          include_recaps: false,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error?.message ?? "Failed");
      toast.success("Salary auto-adjust schedule saved");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(null); }
  };

  const runNow = async () => {
    setBusy("run");
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/commissioner-schedule-tick?force=salary-auto`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": adminSecret() },
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`);
      toast.success("Triggered salary auto-adjust now");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(null); }
  };

  return (
    <div className="rounded-md border border-amber-500/20 bg-background/40 p-3 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs font-semibold flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-primary" />
          Daily Salary Auto-Adjust
          <span className="font-normal text-muted-foreground ml-1">
            (NBA + WNBA · ±1%/gameday · $4.5–$25M WNBA · $4–$30M NBA)
          </span>
        </div>
        {row.last_run_at && (
          <span className="text-[11px] text-muted-foreground">
            Last run:{" "}
            <b className={row.last_status === "error" ? "text-destructive" : "text-foreground"}>
              {new Date(row.last_run_at).toLocaleString()}
            </b>{" "}({row.last_status})
          </span>
        )}
      </div>
      {row.last_error && (
        <div className="text-[11px] text-destructive">Error: {row.last_error}</div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="salary-auto-enabled"
            checked={row.enabled}
            onCheckedChange={(v) => update({ enabled: v })}
          />
          <Label htmlFor="salary-auto-enabled" className="text-xs">Enabled</Label>
        </div>
        <div className="space-y-1">
          <Label htmlFor="salary-auto-time" className="text-xs">Run time (HH:MM)</Label>
          <Input
            id="salary-auto-time"
            type="time"
            value={row.run_time_lisbon}
            onChange={(e) => update({ run_time_lisbon: e.target.value })}
            className="w-28 h-8"
          />
        </div>
        <Button size="sm" onClick={save} disabled={busy !== null}>
          {busy === "save"
            ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            : <Save className="h-3 w-3 mr-1" />}
          Save
        </Button>
        <Button size="sm" variant="secondary" onClick={runNow} disabled={busy !== null}>
          {busy === "run"
            ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            : <Play className="h-3 w-3 mr-1" />}
          Run now
        </Button>
      </div>
    </div>
  );
}