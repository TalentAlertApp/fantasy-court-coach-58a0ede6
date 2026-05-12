import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NBA_TEAMS } from "@/lib/nba-teams";
import { WNBA_TEAMS } from "@/lib/wnba-teams";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCcw, Youtube, ScanSearch } from "lucide-react";
import { toast } from "sonner";

interface MissingRow {
  game_id: string;
  tipoff_utc: string | null;
  home_team: string;
  away_team: string;
  status: string;
}

const LEAGUE_ID: Record<"nba" | "wnba", string> = {
  nba: "c4f2eb76-9ac4-4988-b402-5827aa41861b",
  wnba: "d9825d6d-67bf-417d-aca6-1b4481eb14b5",
};

export default function MissingRecapsPanel({ league }: { league: "nba" | "wnba" }) {
  const logoByTri = useMemo(() => {
    const m = new Map<string, string>();
    const src = league === "wnba" ? WNBA_TEAMS : NBA_TEAMS;
    for (const t of src) m.set(t.tricode, t.logo);
    return m;
  }, [league]);

  const [rows, setRows] = useState<MissingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ batch: number; processed: number; found: number } | null>(null);

  const fetchMissing = async () => {
    setLoading(true);
    try {
      // Page through ALL missing games (no 500-row cap).
      const PAGE = 1000;
      const all: MissingRow[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("schedule_games")
          .select("game_id, tipoff_utc, home_team, away_team, status")
          .eq("league_id", LEAGUE_ID[league])
          .eq("status", "FINAL")
          .is("youtube_recap_id", null)
          .order("tipoff_utc", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const chunk = (data ?? []) as MissingRow[];
        all.push(...chunk);
        if (chunk.length < PAGE) break;
      }
      setRows(all);
    } catch (e: any) {
      toast.error(`Failed to load missing recaps: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMissing(); /* eslint-disable-next-line */ }, [league]);

  const refreshOne = async (game_id: string) => {
    setRefreshingId(game_id);
    try {
      const { data, error } = await supabase.functions.invoke(
        `youtube-recap-lookup?game_id=${encodeURIComponent(game_id)}&replace=1&league=${league}`,
        { body: null },
      );
      if (error) throw error;
      const found = data?.data?.found ?? 0;
      if (found > 0) toast.success(`Recap found for ${game_id}`);
      else toast.info(`No recap match for ${game_id}`);
      await fetchMissing();
    } catch (e: any) {
      toast.error(`Refresh failed: ${e.message}`);
    } finally {
      setRefreshingId(null);
    }
  };

  const rescanMissing = async () => {
    if (rows.length === 0) return;
    setScanning(true);
    setProgress({ batch: 0, processed: 0, found: 0 });
    try {
      const ids = rows.map(r => r.game_id);
      let totalProcessed = 0;
      let totalFound = 0;
      let batch = 0;
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        batch += 1;
        const { data, error } = await supabase.functions.invoke(
          `youtube-recap-lookup?ids=${chunk.join(",")}&replace=1&league=${league}`,
          { body: null },
        );
        if (error) throw error;
        totalProcessed += data?.data?.processed ?? 0;
        totalFound += data?.data?.found ?? 0;
        setProgress({ batch, processed: totalProcessed, found: totalFound });
        if (data?.data?.errors?.some((e: string) => /quota/i.test(e))) {
          toast.warning("YouTube quota reached — try again tomorrow.");
          break;
        }
      }
      toast.success(`Scanned ${totalProcessed} · Found ${totalFound} recaps`);
      await fetchMissing();
    } catch (e: any) {
      toast.error(`Scan failed: ${e.message}`);
    } finally {
      setScanning(false);
    }
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-GB", {
      timeZone: "Europe/Lisbon", weekday: "short", day: "numeric", month: "short",
    });
  };

  return (
    <div className="bg-card border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-5 w-5 text-accent" />
          <h3 className="font-heading font-bold text-lg uppercase">Missing Recaps</h3>
          <Badge variant="outline" className="font-mono uppercase">{league}</Badge>
          <Badge variant="secondary">{loading ? "…" : `${rows.length} games`}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={fetchMissing} disabled={loading}>
            <RefreshCcw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh list
          </Button>
          <Button size="sm" onClick={rescanMissing} disabled={scanning || rows.length === 0}>
            {scanning ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Youtube className="h-3.5 w-3.5 mr-1.5" />}
            Re-scan missing only
          </Button>
        </div>
      </div>

      {progress && (
        <p className="text-xs text-muted-foreground">
          Batch {progress.batch} · Checked <strong className="text-foreground">{progress.processed}</strong> · Found <strong className="text-foreground">{progress.found}</strong>
        </p>
      )}

      {rows.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">All FINAL {league.toUpperCase()} games have recaps. 🎬</p>
      ) : (
        <div className="max-h-96 overflow-y-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Matchup</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.game_id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.tipoff_utc)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {logoByTri.get(r.away_team) && (
                        <img src={logoByTri.get(r.away_team)} alt={r.away_team} className="h-5 w-5 object-contain" />
                      )}
                      <span className="font-mono text-xs">{r.away_team}</span>
                      <span className="text-muted-foreground text-xs">@</span>
                      {logoByTri.get(r.home_team) && (
                        <img src={logoByTri.get(r.home_team)} alt={r.home_team} className="h-5 w-5 object-contain" />
                      )}
                      <span className="font-mono text-xs">{r.home_team}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => refreshOne(r.game_id)}
                      disabled={refreshingId === r.game_id || scanning}
                    >
                      {refreshingId === r.game_id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <RefreshCcw className="h-3.5 w-3.5" />}
                      <span className="ml-1.5 text-xs">Refresh</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}