import { useState, useRef } from "react";
import { Upload, Download, Users, AlertCircle, CheckCircle2, Database, Eye, Calendar, Youtube, Lock, Eye as EyeIcon, EyeOff, BarChart3 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch, importGameData, importSchedule } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ImportResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    upserted: z.number(),
    skipped: z.number(),
    deleted: z.number().optional(),
    total: z.number(),
    errors: z.array(z.string()).optional(),
  }),
});

interface TsvPlayer {
  nba_url: string;
  id: string;
  photo: string;
  name: string;
  team: string;
  fc_bc: string;
  salary: string;
  jersey: string;
  college: string;
  weight: string;
  height: string;
  age: string;
  dob: string;
  exp: string;
  pos: string;
}

type Encoding = "auto" | "utf-8" | "windows-1250" | "windows-1252" | "iso-8859-2";

const ENCODINGS: { value: Encoding; label: string }[] = [
  { value: "auto", label: "Auto-detect" },
  { value: "utf-8", label: "UTF-8" },
  { value: "windows-1250", label: "Windows-1250 (Central European)" },
  { value: "windows-1252", label: "Windows-1252 (Western)" },
  { value: "iso-8859-2", label: "ISO-8859-2 (Latin-2)" },
];

/** Strip surrounding quotes and unescape doubled quotes */
function stripQuotes(v: string): string {
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    return v.slice(1, -1).replace(/""/g, '"');
  }
  return v;
}

/** Parse salary like "22,0" or "4,5" → 22.0 or 4.5 (comma = decimal) */
function parseSalary(raw: string): number {
  if (!raw || raw.trim() === "") return 0;
  const cleaned = stripQuotes(raw.trim()).replace(",", ".");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

/** Decode a buffer with the selected encoding */
function decodeBuffer(buffer: ArrayBuffer, encoding: Encoding): string {
  if (encoding !== "auto") {
    return new TextDecoder(encoding, { fatal: false }).decode(buffer);
  }
  // Auto: try UTF-8 strict, then try multiple fallbacks and pick best
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    // Not valid UTF-8 — try Windows-1250 first (Central European: č, ć, ž, š)
    const w1250 = new TextDecoder("windows-1250", { fatal: false }).decode(buffer);
    // Check if it looks reasonable (has actual diacritics, not replacement chars)
    if (/[čćžšđščćžŠČĆŽĐ]/.test(w1250)) {
      return w1250;
    }
    // Fallback to ISO-8859-2
    const iso2 = new TextDecoder("iso-8859-2", { fatal: false }).decode(buffer);
    if (/[čćžšđščćžŠČĆŽĐ]/.test(iso2)) {
      return iso2;
    }
    // Last resort: windows-1250 anyway (most common for this data)
    return w1250;
  }
}

/** Check if a name looks corrupted (contains ? where diacritics should be) */
function hasCorruptedChars(name: string): boolean {
  return /\?/.test(name) || /\uFFFD/.test(name);
}

function parseTsv(text: string): TsvPlayer[] {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const firstLine = lines[0].replace(/^\uFEFF/, "");
  const header = firstLine.split("\t").map(h => stripQuotes(h.trim()).toUpperCase());

  const colMap: Record<string, number> = {};
  header.forEach((h, i) => { colMap[h] = i; });

  const get = (cols: string[], key: string): string => {
    const idx = colMap[key];
    if (idx === undefined || idx >= cols.length) return "";
    return stripQuotes(cols[idx].trim());
  };

  const players: TsvPlayer[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const id = get(cols, "ID");
    if (!id) continue;

    players.push({
      nba_url: get(cols, "URL"),
      id,
      photo: get(cols, "PHOTO"),
      name: get(cols, "NAME"),
      team: get(cols, "TEAM"),
      fc_bc: get(cols, "FC_BC") || "FC",
      salary: get(cols, "$") || "0",
      jersey: get(cols, "#"),
      college: get(cols, "COLLEGE"),
      weight: get(cols, "WEIGHT") || "0",
      height: get(cols, "HEIGHT"),
      age: get(cols, "AGE") || "0",
      dob: get(cols, "DOB"),
      exp: get(cols, "EXP") || "0",
      pos: get(cols, "POS"),
    });
  }
  return players;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export default function CommissionerPage() {
  const [isLookingUpRecaps, setIsLookingUpRecaps] = useState(false);
  const [recapResult, setRecapResult] = useState<{ processed: number; found: number; remaining: number } | null>(null);

  // Admin secret persisted in localStorage so admin edge functions accept calls.
  const [adminSecret, setAdminSecret] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("nba_admin_secret") ?? "";
  });
  const [showSecret, setShowSecret] = useState(false);
  const saveAdminSecret = (v: string) => {
    setAdminSecret(v);
    try { localStorage.setItem("nba_admin_secret", v); } catch { /* noop */ }
  };

  const handleYoutubeRecapLookup = async (rescanAll = false) => {
    setIsLookingUpRecaps(true);
    setRecapResult(null);
    try {
      const path = rescanAll ? "youtube-recap-lookup?clear=1&limit=100" : "youtube-recap-lookup";
      const { data, error } = await supabase.functions.invoke(path, { body: null });
      if (error) throw error;
      if (data?.ok && data.data) {
        setRecapResult(data.data);
        toast.success(
          `${rescanAll ? "Re-scanned: " : ""}Found ${data.data.found} recaps (${data.data.remaining} remaining)`,
        );
        if (data.data.errors?.length) {
          toast.warning(`${data.data.errors.length} errors`);
          console.warn("Recap lookup errors:", data.data.errors);
        }
      } else {
        throw new Error(data?.error?.message || "Unknown error");
      }
    } catch (err: any) {
      toast.error(`Recap lookup failed: ${err.message}`);
    } finally {
      setIsLookingUpRecaps(false);
    }
  };

  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isImportingGames, setIsImportingGames] = useState(false);
  const [isImportingSchedule, setIsImportingSchedule] = useState(false);
  const [replaceGames, setReplaceGames] = useState(true);
  const [replaceSchedule, setReplaceSchedule] = useState(true);
  const [isImportingAdv, setIsImportingAdv] = useState(false);
  const [replaceAdv, setReplaceAdv] = useState(true);
  const [lastAdvResult, setLastAdvResult] = useState<{ updated: number; total: number; nulled_out?: number } | null>(null);
  const [advPreview, setAdvPreview] = useState<Array<Record<string, any>> | null>(null);
  const [advPendingPayload, setAdvPendingPayload] = useState<Array<Record<string, any>> | null>(null);
  const advFileRef = useRef<HTMLInputElement>(null);
  const [encoding, setEncoding] = useState<Encoding>("auto");
  const [lastResult, setLastResult] = useState<{ upserted: number; total: number; deleted?: number } | null>(null);
  const [lastGameResult, setLastGameResult] = useState<{ games: number; logs: number } | null>(null);
  const [lastScheduleResult, setLastScheduleResult] = useState<{ games: number } | null>(null);
  const [preview, setPreview] = useState<TsvPlayer[] | null>(null);
  const [pendingPayload, setPendingPayload] = useState<any[] | null>(null);
  const [corruptCount, setCorruptCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const gameFileRef = useRef<HTMLInputElement>(null);
  const scheduleFileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const text = decodeBuffer(buffer, encoding);
      const players = parseTsv(text);

      console.log("[Commissioner] Encoding:", encoding);
      console.log("[Commissioner] First 5 parsed names:", players.slice(0, 5).map(p => p.name));

      if (players.length === 0) {
        toast.error("No valid players found in TSV file");
        return;
      }

      // Check for corruption
      const corrupt = players.filter(p => hasCorruptedChars(p.name));
      setCorruptCount(corrupt.length);
      if (corrupt.length > 0) {
        console.warn("[Commissioner] Corrupted names found:", corrupt.slice(0, 10).map(p => `${p.id}: ${p.name}`));
      }

      // Show preview (first 10 + any corrupted ones)
      const previewPlayers = players.slice(0, 10);
      // Add some corrupted ones to preview if not already there
      for (const cp of corrupt.slice(0, 5)) {
        if (!previewPlayers.find(p => p.id === cp.id)) {
          previewPlayers.push(cp);
        }
      }
      setPreview(previewPlayers);

      // Prepare payload
      const payload = players.map(p => ({
        ...p,
        salary: parseSalary(p.salary),
      }));
      setPendingPayload(payload);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Parse failed: ${msg}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleConfirmImport = async () => {
    if (!pendingPayload) return;
    setIsUploading(true);
    setLastResult(null);
    try {
      const result = await apiFetch("import-players", ImportResponseSchema, {
        method: "POST",
        body: JSON.stringify({ players: pendingPayload, replace: true }),
      });

      if (result.ok) {
        setLastResult({ upserted: result.data.upserted, total: result.data.total, deleted: result.data.deleted });
        toast.success(`Imported ${result.data.upserted} players`);
        if (result.data.errors?.length) {
          toast.warning(`${result.data.errors.length} errors during import`);
        }
        setPreview(null);
        setPendingPayload(null);
        setCorruptCount(0);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Import failed: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelPreview = () => {
    setPreview(null);
    setPendingPayload(null);
    setCorruptCount(0);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const { data: players, error } = await supabase
        .from("players")
        .select("id, nba_url, photo, name, team, fc_bc, salary, jersey, college, weight, height, age, dob, exp, pos")
        .order("name");

      if (error) throw new Error(error.message);
      if (!players?.length) {
        toast.warning("No players to export");
        return;
      }

      const header = "URL\tID\tPHOTO\tNAME\tTEAM\tFC_BC\t$\t#\tCOLLEGE\tWEIGHT\tHEIGHT\tAGE\tDOB\tEXP\tPOS";
      const rows = players.map(p => {
        return [p.nba_url, p.id, p.photo, p.name, p.team, p.fc_bc, p.salary, p.jersey, p.college,
          p.weight, p.height, p.age, p.dob, p.exp, p.pos].map(v => String(v ?? "")).join("\t");
      });

      const tsv = [header, ...rows].join("\n");
      const blob = new Blob([tsv], { type: "text/tab-separated-values" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `players_${new Date().toISOString().split("T")[0]}.tsv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${players.length} players`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Export failed: ${msg}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const [gameProgress, setGameProgress] = useState<string | null>(null);

  const handleGameDataUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingGames(true);
    setLastGameResult(null);
    setGameProgress(null);
    try {
      const buffer = await file.arrayBuffer();
      const text = decodeBuffer(buffer, encoding);
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) {
        toast.error("No valid game data found");
        return;
      }

      const headerLine = lines[0].replace(/^\uFEFF/, "");
      const isTsv = headerLine.includes("\t");

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = isTsv ? lines[i].split("\t").map(c => c.trim()) : parseCSVLine(lines[i]);
        if (!cols[10]) continue;

        rows.push({
          week: parseInt(cols[0]) || 1,
          day: parseInt(cols[1]) || 1,
          date: (cols[2] || "").trim(),
          dayName: (cols[3] || "").trim(),
          time: (cols[4] || "").trim(),
          homeTeam: (cols[5] || "").trim(),
          awayTeam: (cols[6] || "").trim(),
          homeScore: parseInt(cols[7]) || 0,
          awayScore: parseInt(cols[8]) || 0,
          status: (cols[9] || "SCHEDULED").trim(),
          gameId: (cols[10] || "").trim(),
          playerId: parseInt(cols[11]) || 0,
          playerName: (cols[12] || "").trim(),
          pts: parseFloat(cols[13]) || 0,
          mp: parseInt(cols[14]) || 0,
          ps: parseInt(cols[15]) || 0,
          r: parseInt(cols[16]) || 0,
          a: parseInt(cols[17]) || 0,
          b: parseInt(cols[18]) || 0,
          s: parseInt(cols[19]) || 0,
        });
      }

      if (rows.length === 0) {
        toast.error("No valid game data rows found");
        return;
      }

      // Chunk into batches of 2000 to avoid edge function timeout
      const BATCH_SIZE = 2000;
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
      let totalGames = 0;
      let totalLogs = 0;
      let totalErrors: string[] = [];

      for (let b = 0; b < totalBatches; b++) {
        const batch = rows.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        const isFirst = b === 0;
        setGameProgress(`Importing batch ${b + 1}/${totalBatches} (${batch.length} rows)…`);

        const result = await importGameData(batch, replaceGames && isFirst);
        totalGames += result.games_imported;
        totalLogs += result.player_logs_imported;
        if (result.errors?.length) totalErrors.push(...result.errors);
      }

      setGameProgress(null);
      setLastGameResult({ games: totalGames, logs: totalLogs });
      toast.success(`Imported ${totalGames} games, ${totalLogs} player logs (${totalBatches} batches)`);

      if (totalErrors.length) {
        toast.warning(`${totalErrors.length} errors during import`);
        console.warn("Import errors:", totalErrors.slice(0, 50));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Game data import failed: ${msg}`);
    } finally {
      setIsImportingGames(false);
      setGameProgress(null);
      if (gameFileRef.current) gameFileRef.current.value = "";
    }
  };

  const SCHEDULE_HEADER_MAP: Record<string, string> = {
    "WEEK": "gw", "DAY": "day", "DATE": "date", "DAY NAME": "dayName",
    "TIME": "time", "HOME TEAM": "home_team", "AWAY TEAM": "away_team",
    "STATUS": "status", "HOME SCORE": "home_pts", "AWAY SCORE": "away_pts",
    "GAME ID": "game_id", "GAME URL": "nba_game_url", "GAME RECAP": "game_recap_url",
    "GAME BOXSCORE": "game_boxscore_url", "GAME CHARTS": "game_charts_url",
    "GAME PLAY_BY_PLAY": "game_playbyplay_url",
  };

  const handleScheduleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingSchedule(true);
    setLastScheduleResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const text = decodeBuffer(buffer, encoding);
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) { toast.error("No valid schedule data found"); return; }

      const headerLine = lines[0].replace(/^\uFEFF/, "");
      const isTsv = headerLine.includes("\t");
      const headers = (isTsv ? headerLine.split("\t") : parseCSVLine(headerLine))
        .map(h => stripQuotes(h.trim()).toUpperCase());

      const colIdx: Record<string, number> = {};
      headers.forEach((h, i) => { const mapped = SCHEDULE_HEADER_MAP[h]; if (mapped) colIdx[mapped] = i; });

      if (colIdx.game_id === undefined) { toast.error("Missing 'Game ID' column in header"); return; }

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = isTsv ? lines[i].split("\t").map(c => c.trim()) : parseCSVLine(lines[i]);
        const get = (key: string) => { const idx = colIdx[key]; return idx !== undefined && idx < cols.length ? stripQuotes(cols[idx]) : ""; };
        const gameId = get("game_id");
        if (!gameId) continue;
        rows.push({
          gw: parseInt(get("gw")) || 1, day: parseInt(get("day")) || 1,
          date: get("date"), dayName: get("dayName"), time: get("time"),
          home_team: get("home_team"), away_team: get("away_team"),
          status: get("status") || "SCHEDULED",
          home_pts: parseInt(get("home_pts")) || 0, away_pts: parseInt(get("away_pts")) || 0,
          game_id: gameId,
          nba_game_url: get("nba_game_url") || null, game_recap_url: get("game_recap_url") || null,
          game_boxscore_url: get("game_boxscore_url") || null, game_charts_url: get("game_charts_url") || null,
          game_playbyplay_url: get("game_playbyplay_url") || null,
        });
      }

      if (rows.length === 0) { toast.error("No valid schedule rows found"); return; }
      console.log(`[Commissioner] Importing ${rows.length} schedule games (replace=${replaceSchedule})`);
      const result = await importSchedule(rows, replaceSchedule);
      setLastScheduleResult({ games: result.games_imported });
      toast.success(`Imported ${result.games_imported} schedule games`);
      if (result.errors?.length) { toast.warning(`${result.errors.length} errors`); console.warn("Schedule errors:", result.errors); }
    } catch (err: unknown) {
      toast.error(`Schedule import failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsImportingSchedule(false);
      if (scheduleFileRef.current) scheduleFileRef.current.value = "";
    }
  };

  // ---------- Advanced Stats CSV import (end-of-Regular-Season totals) ----------
  const ADV_HEADER_MAP: Record<string, string> = {
    "ID": "id",
    "FGM": "fgm", "FGA": "fga", "FG_PCT": "fg_pct",
    "3PM": "tpm", "3PA": "tpa", "3P_PCT": "tp_pct",
    "FTM": "ftm", "FTA": "fta", "FT_PCT": "ft_pct",
    "OREB": "oreb", "DREB": "dreb",
    "TOV": "tov", "PF": "pf", "PLUS_MINUS": "plus_minus",
  };

  const handleAdvFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const text = decodeBuffer(buffer, encoding);
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) { toast.error("No rows found"); return; }

      const headerLine = lines[0].replace(/^\uFEFF/, "");
      const isTsv = headerLine.includes("\t");
      const headers = (isTsv ? headerLine.split("\t") : parseCSVLine(headerLine))
        .map(h => stripQuotes(h.trim()).toUpperCase());
      const colIdx: Record<string, number> = {};
      headers.forEach((h, i) => { const m = ADV_HEADER_MAP[h]; if (m) colIdx[m] = i; });
      if (colIdx.id === undefined) { toast.error("Missing 'ID' column in header"); return; }

      const rows: Array<Record<string, any>> = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = isTsv ? lines[i].split("\t").map(c => c.trim()) : parseCSVLine(lines[i]);
        const get = (key: string) => { const idx = colIdx[key]; return idx !== undefined && idx < cols.length ? stripQuotes(cols[idx]) : ""; };
        const id = parseInt(get("id"));
        if (!id || isNaN(id)) continue;
        rows.push({
          id,
          fgm: get("fgm"), fga: get("fga"), fg_pct: get("fg_pct"),
          tpm: get("tpm"), tpa: get("tpa"), tp_pct: get("tp_pct"),
          ftm: get("ftm"), fta: get("fta"), ft_pct: get("ft_pct"),
          oreb: get("oreb"), dreb: get("dreb"),
          tov: get("tov"), pf: get("pf"), plus_minus: get("plus_minus"),
        });
      }
      if (rows.length === 0) { toast.error("No valid rows parsed"); return; }
      setAdvPreview(rows.slice(0, 8));
      setAdvPendingPayload(rows);
    } catch (err: unknown) {
      toast.error(`Parse failed: ${err instanceof Error ? err.message : "Unknown"}`);
    }
    if (advFileRef.current) advFileRef.current.value = "";
  };

  const handleConfirmAdvImport = async () => {
    if (!advPendingPayload) return;
    setIsImportingAdv(true);
    setLastAdvResult(null);
    try {
      const result = await apiFetch(
        "import-player-advanced-stats",
        z.object({
          ok: z.literal(true),
          data: z.object({
            updated: z.number(),
            skipped: z.number(),
            nulled_out: z.number().optional(),
            total: z.number(),
            errors: z.array(z.string()).optional(),
          }),
        }),
        { method: "POST", body: JSON.stringify({ rows: advPendingPayload, replace: replaceAdv }) },
      );
      if (result.ok) {
        setLastAdvResult({ updated: result.data.updated, total: result.data.total, nulled_out: result.data.nulled_out });
        toast.success(`Updated ${result.data.updated} players' advanced stats${result.data.nulled_out ? ` · cleared ${result.data.nulled_out}` : ""}`);
        if (result.data.errors?.length) toast.warning(`${result.data.errors.length} errors`);
        setAdvPreview(null);
        setAdvPendingPayload(null);
      }
    } catch (err: unknown) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setIsImportingAdv(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-heading font-bold">Commissioner</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Manage the player database. Upload a TSV file to <strong>fully replace</strong> all player data
        (URL, photo, team, salary, position, DOB, etc.). This is the single source of truth.
      </p>

      {/* Admin Secret — required for write/import endpoints */}
      <div className="bg-card border border-accent/30 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-accent" />
          <Label className="text-sm font-medium">Admin Secret</Label>
          {adminSecret ? (
            <span className="text-[10px] uppercase tracking-wider text-emerald-500 font-bold">Saved</span>
          ) : (
            <span className="text-[10px] uppercase tracking-wider text-destructive font-bold">Required</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type={showSecret ? "text" : "password"}
            value={adminSecret}
            onChange={(e) => saveAdminSecret(e.target.value)}
            placeholder="Paste your ADMIN_API_SECRET here"
            className="font-mono text-xs"
            autoComplete="off"
          />
          <Button
            variant="outline"
            size="icon"
            type="button"
            onClick={() => setShowSecret((s) => !s)}
            aria-label={showSecret ? "Hide secret" : "Show secret"}
          >
            {showSecret ? <EyeOff className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Stored locally in your browser only. Required to call player imports, sync, salary, schedule and game-data endpoints.
        </p>
      </div>

      {/* Encoding Selector */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium whitespace-nowrap">File encoding:</Label>
        <Select value={encoding} onValueChange={(v) => setEncoding(v as Encoding)}>
          <SelectTrigger className="w-[280px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENCODINGS.map(e => (
              <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          Use Windows-1250 for files with č, ć, ž, š characters
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upload Card */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="section-bar">Upload Player Database</div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              TSV format (tab-separated): URL, ID, PHOTO, NAME, TEAM, FC_BC, $, #, COLLEGE, WEIGHT, HEIGHT, AGE, DOB, EXP, POS
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".tsv,.csv,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={isUploading || preview !== null}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? "Importing…" : "Select TSV File"}
            </Button>

            {lastResult && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" />
                {lastResult.upserted} / {lastResult.total} players imported
                {lastResult.deleted ? `, ${lastResult.deleted} old players removed` : ""}
              </div>
            )}
          </div>
        </div>

        {/* Download Card */}
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="section-bar">Download Player Database</div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Export current player data as TSV. Includes all players in the database.
            </p>
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              variant="outline"
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? "Exporting…" : "Download TSV"}
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Table */}
      {preview && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="section-bar flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview — Verify Names Before Import
          </div>
          <div className="p-4 space-y-3">
            {corruptCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  <strong>{corruptCount} names contain '?' characters</strong> — likely encoding issue.
                  Try selecting a different encoding (e.g. Windows-1250) and re-select the file.
                </span>
              </div>
            )}
            <div className="overflow-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[60px]">Team</TableHead>
                    <TableHead className="w-[60px]">Pos</TableHead>
                    <TableHead className="w-[60px]">Salary</TableHead>
                    <TableHead className="w-[40px]">OK?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map(p => {
                    const corrupted = hasCorruptedChars(p.name);
                    return (
                      <TableRow key={p.id} className={corrupted ? "bg-destructive/5" : ""}>
                        <TableCell className="font-mono text-xs">{p.id}</TableCell>
                        <TableCell className={corrupted ? "text-destructive font-medium" : ""}>
                          {p.name}
                        </TableCell>
                        <TableCell>{p.team}</TableCell>
                        <TableCell>{p.pos}</TableCell>
                        <TableCell>{p.salary}</TableCell>
                        <TableCell>
                          {corrupted ? "⚠️" : "✅"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleConfirmImport}
                disabled={isUploading}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? "Importing…" : `Confirm Import (${pendingPayload?.length ?? 0} players)`}
              </Button>
              <Button
                onClick={handleCancelPreview}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Game Data Import Card */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="section-bar flex items-center gap-2">
          <Database className="h-4 w-4" />
          Import Game Data
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            TSV/CSV: Week, Day, Date, Day Name, Time, Home Team, Away Team, Home Score, Away Score, Status, Game ID, ID, Player, PTS, MP, PS, R, A, B, S
          </p>
          <div className="flex items-center gap-2">
            <Switch id="replace-games" checked={replaceGames} onCheckedChange={setReplaceGames} />
            <Label htmlFor="replace-games" className="text-sm">
              Full replace <span className="text-muted-foreground">(wipe existing data before import)</span>
            </Label>
          </div>
          <input
            ref={gameFileRef}
            type="file"
            accept=".tsv,.csv,.txt"
            onChange={handleGameDataUpload}
            className="hidden"
          />
          <Button
            onClick={() => gameFileRef.current?.click()}
            disabled={isImportingGames}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isImportingGames ? (gameProgress || "Importing…") : "Upload Game Data"}
          </Button>

          {lastGameResult && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              {lastGameResult.games} games, {lastGameResult.logs} player logs imported
            </div>
          )}
        </div>
      </div>

      {/* Schedule Import Card */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="section-bar flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Import Schedule
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            TSV: Week, Day, Date, Day Name, Time, Home Team, Away Team, Status, Home Score, Away Score, Game ID, Game URL, Game Recap, Game BoxScore, Game Charts, Game Play_By_Play
          </p>
          <div className="flex items-center gap-2">
            <Switch id="replace-schedule" checked={replaceSchedule} onCheckedChange={setReplaceSchedule} />
            <Label htmlFor="replace-schedule" className="text-sm">
              Full replace <span className="text-muted-foreground">(wipe existing schedule before import)</span>
            </Label>
          </div>
          <input
            ref={scheduleFileRef}
            type="file"
            accept=".tsv,.csv,.txt"
            onChange={handleScheduleUpload}
            className="hidden"
          />
          <Button
            onClick={() => scheduleFileRef.current?.click()}
            disabled={isImportingSchedule}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {isImportingSchedule ? "Importing…" : "Upload Schedule TSV"}
          </Button>

          {lastScheduleResult && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              {lastScheduleResult.games} schedule games imported
            </div>
          )}
        </div>
      </div>

      {/* Advanced Player Stats Import Card */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="section-bar flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Import Player Advanced Stats
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            CSV/TSV: ID, NAME, TEAM, FGM, FGA, FG_PCT, 3PM, 3PA, 3P_PCT, FTM, FTA, FT_PCT, OREB, DREB, TOV, PF, PLUS_MINUS — end-of-Regular-Season totals.
          </p>
          <div className="flex items-center gap-2">
            <Switch id="replace-adv" checked={replaceAdv} onCheckedChange={setReplaceAdv} />
            <Label htmlFor="replace-adv" className="text-sm">
              Full replace <span className="text-muted-foreground">(NULL stats for players not in file)</span>
            </Label>
          </div>
          <input
            ref={advFileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleAdvFileSelect}
            className="hidden"
          />
          <Button
            onClick={() => advFileRef.current?.click()}
            disabled={isImportingAdv}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {advPreview ? "Reload File" : "Upload Advanced Stats CSV"}
          </Button>
          {advPreview && advPendingPayload && (
            <div className="space-y-2 border-t pt-3">
              <p className="text-xs font-heading uppercase text-muted-foreground">
                Preview ({advPendingPayload.length} rows total · showing first {advPreview.length})
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">ID</TableHead>
                      <TableHead className="text-[10px]">FG%</TableHead>
                      <TableHead className="text-[10px]">3P%</TableHead>
                      <TableHead className="text-[10px]">FT%</TableHead>
                      <TableHead className="text-[10px]">OREB</TableHead>
                      <TableHead className="text-[10px]">DREB</TableHead>
                      <TableHead className="text-[10px]">TOV</TableHead>
                      <TableHead className="text-[10px]">+/-</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {advPreview.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{r.id}</TableCell>
                        <TableCell className="font-mono text-xs">{r.fg_pct}</TableCell>
                        <TableCell className="font-mono text-xs">{r.tp_pct}</TableCell>
                        <TableCell className="font-mono text-xs">{r.ft_pct}</TableCell>
                        <TableCell className="font-mono text-xs">{r.oreb}</TableCell>
                        <TableCell className="font-mono text-xs">{r.dreb}</TableCell>
                        <TableCell className="font-mono text-xs">{r.tov}</TableCell>
                        <TableCell className="font-mono text-xs">{r.plus_minus}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleConfirmAdvImport} disabled={isImportingAdv} className="flex-1">
                  <Upload className="h-4 w-4 mr-2" />
                  {isImportingAdv ? "Importing…" : `Confirm Import (${advPendingPayload.length} rows)`}
                </Button>
                <Button onClick={() => { setAdvPreview(null); setAdvPendingPayload(null); }} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {lastAdvResult && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              {lastAdvResult.updated}/{lastAdvResult.total} updated
              {lastAdvResult.nulled_out ? ` · ${lastAdvResult.nulled_out} cleared` : ""}
            </div>
          )}
        </div>
      </div>

      {/* YouTube Recaps */}
      <div className="bg-card border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Youtube className="h-5 w-5 text-destructive" />
          <h3 className="font-heading font-bold text-lg uppercase">YouTube Recaps</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Auto-populate YouTube recap video IDs for all finished games missing a recap.
          Uses the YouTube Data API to search for "Motion Station" recaps.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <Button
            onClick={() => handleYoutubeRecapLookup(false)}
            disabled={isLookingUpRecaps}
          >
            <Youtube className="h-4 w-4 mr-2" />
            {isLookingUpRecaps ? "Looking up recaps…" : "Populate YouTube Recaps"}
          </Button>
          <Button
            onClick={() => handleYoutubeRecapLookup(true)}
            disabled={isLookingUpRecaps}
            variant="outline"
          >
            <Youtube className="h-4 w-4 mr-2" />
            Re-scan All Recaps
          </Button>
        </div>
        {recapResult && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Found {recapResult.found}/{recapResult.processed} recaps · {recapResult.remaining} remaining
          </div>
        )}
      </div>
      <div className="flex items-start gap-2 bg-muted/50 border rounded-lg p-3">
        <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Full replace mode:</strong> uploading a TSV wipes the entire players table and replaces it with the file contents.</p>
          <p><strong>Salary</strong> is imported from the $ column (comma = decimal separator, e.g. "22,0" → 22.0).</p>
          <p><strong>Age</strong> is automatically calculated from DOB on import.</p>
          <p><strong>Encoding:</strong> If names with special characters (č, ć, ž, š) show as '?', select <em>Windows-1250</em> encoding and re-upload.</p>
        </div>
      </div>
    </div>
  );
}
