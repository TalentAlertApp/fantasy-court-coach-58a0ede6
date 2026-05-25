import { useState, useRef } from "react";
import { Upload, Download, Users, AlertCircle, CheckCircle2, Database, Eye, Calendar, Youtube, Lock, Eye as EyeIcon, EyeOff, BarChart3 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch, importGameData, importGameDataLeague, importSchedule } from "@/lib/api";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { WNBA_TEAMS } from "@/lib/wnba-teams";
import { NBA_TEAMS } from "@/lib/nba-teams";
import MissingRecapsPanel from "@/components/commissioner/MissingRecapsPanel";
import WnbaSheetSyncPanel from "@/components/commissioner/WnbaSheetSyncPanel";
import EuroleagueSheetSyncPanel from "@/components/commissioner/EuroleagueSheetSyncPanel";
import SalaryAutoSchedulePanel from "@/components/commissioner/SalaryAutoSchedulePanel";
import nbaLogoSrc from "@/assets/nba-logo.svg";
import wnbaLogoSrc from "@/assets/wnba-logo.png";
import euroleagueLogoSrc from "@/assets/euroleague-logo.png";
import CommissionerAccessGate from "@/components/commissioner/CommissionerAccessGate";

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
  const [recapProgress, setRecapProgress] = useState<{
    batches: number;
    processed: number;
    found: number;
    remaining: number;
    phase: "idle" | "running" | "done";
    mode: "populate" | "rescan";
  }>({ batches: 0, processed: 0, found: 0, remaining: 0, phase: "idle", mode: "populate" });

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") return "players";
    return localStorage.getItem("commissioner_active_tab") ?? "players";
  });
  const handleTabChange = (v: string) => {
    setActiveTab(v);
    try { localStorage.setItem("commissioner_active_tab", v); } catch { /* noop */ }
  };

  // League selector — drives league_code sent with every import
  const [leagueCode, setLeagueCode] = useState<"nba" | "wnba" | "euroleague">(() => {
    if (typeof window === "undefined") return "nba";
    return ((localStorage.getItem("commissioner_league") as "nba" | "wnba" | "euroleague") ?? "nba");
  });
  const handleLeagueChange = (v: "nba" | "wnba" | "euroleague") => {
    setLeagueCode(v);
    try { localStorage.setItem("commissioner_league", v); } catch { /* noop */ }
  };

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
    setRecapProgress({
      batches: 0, processed: 0, found: 0, remaining: 0,
      phase: "running", mode: rescanAll ? "rescan" : "populate",
    });
    let totalProcessed = 0;
    let totalFound = 0;
    let remaining = Infinity;
    let batches = 0;
    const MAX_BATCHES = 25;
    try {
      while (remaining > 0 && batches < MAX_BATCHES) {
        // Re-scan now uses replace=1 on every batch: per-game we only overwrite
        // an existing recap id when YouTube actually returns a fresh match.
        // No more bulk-wipe — old IDs are always preserved if no replacement is found.
        const path = rescanAll
          ? "youtube-recap-lookup?replace=1&limit=100"
          : "youtube-recap-lookup?limit=100";
        const { data, error } = await supabase.functions.invoke(path, { body: null });
        if (error) throw error;
        if (!data?.ok || !data.data) throw new Error(data?.error?.message || "Unknown error");
        batches += 1;
        totalProcessed += data.data.processed ?? 0;
        totalFound += data.data.found ?? 0;
        remaining = data.data.remaining ?? 0;
        setRecapProgress({
          batches, processed: totalProcessed, found: totalFound, remaining,
          phase: "running", mode: rescanAll ? "rescan" : "populate",
        });
        if (data.data.errors?.length) {
          console.warn("Recap lookup errors:", data.data.errors);
          // Quota error: stop the loop
          if (data.data.errors.some((e: string) => /quota/i.test(e))) {
            toast.warning("YouTube API quota reached — try again later.");
            break;
          }
        }
        // Stop when this batch produced zero new finds AND nothing was processed
        if ((data.data.processed ?? 0) === 0) break;
      }
      setRecapProgress((p) => ({ ...p, phase: "done" }));
      toast.success(
        `${rescanAll ? "Re-scanned" : "Populated"}: ${totalFound} recaps across ${batches} batch${batches === 1 ? "" : "es"} · ${remaining} remaining`,
      );
      try { localStorage.setItem("nbaf:recap_last_run_at", new Date().toISOString()); } catch { /* noop */ }
    } catch (err: any) {
      setRecapProgress((p) => ({ ...p, phase: "done" }));
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
  const [replaceAdv, setReplaceAdv] = useState(false);
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
  const [playerValidation, setPlayerValidation] = useState<{
    rowCount: number;
    duplicateIds: string[];
    invalidFcBc: string[];
    badDob: string[];
    blankName: string[];
    unknownTeams: string[];
    detectedTeams: string[];
    expectedRows?: number;
    blockers: string[];
  } | null>(null);
  const [scheduleValidation, setScheduleValidation] = useState<{
    rowCount: number;
    duplicateGameIds: string[];
    unknownTeams: string[];
    detectedTeams: string[];
    perTeamCounts: Record<string, number>;
    expectedRows?: number;
    expectedTeams?: number;
    expectedPerTeam?: number;
    blockers: string[];
  } | null>(null);
  const [schedulePreview, setSchedulePreview] = useState<any[] | null>(null);
  const [schedulePendingPayload, setSchedulePendingPayload] = useState<any[] | null>(null);
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

      // ---- League-aware validation ----
      const validTricodes = new Set(
        (leagueCode === "wnba" ? WNBA_TEAMS : NBA_TEAMS).map(t => t.tricode.toUpperCase())
      );
      const idSeen = new Map<string, number>();
      const duplicateIds: string[] = [];
      const invalidFcBc: string[] = [];
      const badDob: string[] = [];
      const blankName: string[] = [];
      const unknownTeams = new Set<string>();
      const detected = new Set<string>();
      for (const p of players) {
        idSeen.set(p.id, (idSeen.get(p.id) ?? 0) + 1);
        const tri = (p.team || "").toUpperCase();
        if (tri) {
          detected.add(tri);
          if (!validTricodes.has(tri)) unknownTeams.add(tri);
        }
        if (!p.name || !p.name.trim()) blankName.push(p.id);
        if (!["FC", "BC"].includes((p.fc_bc || "").toUpperCase())) invalidFcBc.push(p.id);
        if (p.dob && isNaN(Date.parse(p.dob))) badDob.push(p.id);
      }
      for (const [id, n] of idSeen) if (n > 1) duplicateIds.push(id);
      const blockers: string[] = [];
      if (duplicateIds.length) blockers.push(`${duplicateIds.length} duplicate ID(s)`);
      if (blankName.length) blockers.push(`${blankName.length} blank NAME`);
      if (invalidFcBc.length) blockers.push(`${invalidFcBc.length} invalid FC_BC (must be FC or BC)`);
      if (unknownTeams.size) blockers.push(`${unknownTeams.size} unknown TEAM code(s) for ${leagueCode.toUpperCase()}`);
      setPlayerValidation({
        rowCount: players.length,
        duplicateIds: duplicateIds.slice(0, 10),
        invalidFcBc: invalidFcBc.slice(0, 10),
        badDob: badDob.slice(0, 10),
        blankName: blankName.slice(0, 10),
        unknownTeams: Array.from(unknownTeams),
        detectedTeams: Array.from(detected).sort(),
        expectedRows: leagueCode === "wnba" ? 255 : undefined,
        blockers,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Parse failed: ${msg}`);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleConfirmImport = async () => {
    if (!pendingPayload) return;
    if (playerValidation && playerValidation.blockers.length > 0) {
      toast.error(`Import blocked: ${playerValidation.blockers.join(", ")}`);
      return;
    }
    setIsUploading(true);
    setLastResult(null);
    try {
      const result = await apiFetch("import-players", ImportResponseSchema, {
        method: "POST",
        body: JSON.stringify({ players: pendingPayload, replace: true, league_code: leagueCode }),
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
    setPlayerValidation(null);
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

        const result = await importGameDataLeague(batch, replaceGames && isFirst, leagueCode as "nba" | "wnba");
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

      // ---- League-aware validation ----
      const validTricodes = new Set(
        (leagueCode === "wnba" ? WNBA_TEAMS : NBA_TEAMS).map(t => t.tricode.toUpperCase())
      );
      const idSeen = new Map<string, number>();
      const duplicateGameIds: string[] = [];
      const unknownTeams = new Set<string>();
      const detected = new Set<string>();
      const perTeamCounts: Record<string, number> = {};
      for (const r of rows) {
        idSeen.set(r.game_id, (idSeen.get(r.game_id) ?? 0) + 1);
        for (const tri of [String(r.home_team).toUpperCase(), String(r.away_team).toUpperCase()]) {
          if (!tri) continue;
          detected.add(tri);
          if (!validTricodes.has(tri)) unknownTeams.add(tri);
          perTeamCounts[tri] = (perTeamCounts[tri] ?? 0) + 1;
        }
      }
      for (const [id, n] of idSeen) if (n > 1) duplicateGameIds.push(id);
      const blockers: string[] = [];
      if (duplicateGameIds.length) blockers.push(`${duplicateGameIds.length} duplicate Game ID(s)`);
      if (unknownTeams.size) blockers.push(`${unknownTeams.size} unknown team code(s) for ${leagueCode.toUpperCase()}`);

      setSchedulePendingPayload(rows);
      setSchedulePreview(rows.slice(0, 10));
      setScheduleValidation({
        rowCount: rows.length,
        duplicateGameIds: duplicateGameIds.slice(0, 10),
        unknownTeams: Array.from(unknownTeams),
        detectedTeams: Array.from(detected).sort(),
        perTeamCounts,
        expectedRows: leagueCode === "wnba" ? 330 : undefined,
        expectedTeams: leagueCode === "wnba" ? 15 : undefined,
        expectedPerTeam: leagueCode === "wnba" ? 44 : undefined,
        blockers,
      });
    } catch (err: unknown) {
      toast.error(`Schedule import failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      if (scheduleFileRef.current) scheduleFileRef.current.value = "";
    }
  };

  const handleConfirmScheduleImport = async () => {
    if (!schedulePendingPayload) return;
    if (scheduleValidation && scheduleValidation.blockers.length > 0) {
      toast.error(`Import blocked: ${scheduleValidation.blockers.join(", ")}`);
      return;
    }
    setIsImportingSchedule(true);
    try {
      const result = await importSchedule(schedulePendingPayload, replaceSchedule, leagueCode as "nba" | "wnba");
      setLastScheduleResult({ games: result.games_imported });
      toast.success(`Imported ${result.games_imported} schedule games`);
      if (result.errors?.length) { toast.warning(`${result.errors.length} errors`); console.warn("Schedule errors:", result.errors); }
      setSchedulePreview(null);
      setSchedulePendingPayload(null);
      setScheduleValidation(null);
    } catch (err: unknown) {
      toast.error(`Schedule import failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsImportingSchedule(false);
    }
  };

  const handleCancelSchedulePreview = () => {
    setSchedulePreview(null);
    setSchedulePendingPayload(null);
    setScheduleValidation(null);
  };

  // ---------- Advanced Stats CSV import (season-to-date accumulated totals) ----------
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
        { method: "POST", body: JSON.stringify({ rows: advPendingPayload, replace: replaceAdv, league_code: leagueCode }) },
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
    <CommissionerAccessGate>
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

      {/* League Selector — scopes Players & Schedule imports to this league */}
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <Label className="text-sm font-semibold whitespace-nowrap">Import league:</Label>
        <Select value={leagueCode} onValueChange={(v) => handleLeagueChange(v as "nba" | "wnba" | "euroleague")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nba">
              <span className="inline-flex items-center gap-2">
                <img src={nbaLogoSrc} alt="NBA" className="h-4 w-4 object-contain" />
                NBA
              </span>
            </SelectItem>
            <SelectItem value="wnba">
              <span className="inline-flex items-center gap-2">
                <img src={wnbaLogoSrc} alt="WNBA" className="h-4 w-4 object-contain" />
                WNBA
              </span>
            </SelectItem>
            <SelectItem value="euroleague">
              <span className="inline-flex items-center gap-2">
                <img src={euroleagueLogoSrc} alt="EuroLeague" className="h-4 w-4 object-contain" />
                EuroLeague
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          Player, Schedule & Advanced Stats imports below apply <strong className="text-foreground">only</strong> to the selected league.
          Replace = true will not affect the other league's data.
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="players">Players</TabsTrigger>
          <TabsTrigger value="game-data">Game Data</TabsTrigger>
          <TabsTrigger value="sync">Sync</TabsTrigger>
        </TabsList>

        <TabsContent value="players" className="space-y-6 mt-0">
          {leagueCode === "wnba" && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-amber-300">WNBA Salary Generation</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Recalculate every WNBA player's salary from their <strong>EXP</strong>.
                    Rookies (R) get $4.5M, the most experienced gets $25M (linear).
                    This becomes the only source of truth for WNBA salaries.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await apiFetch(
                        "wnba-salary-recalc",
                        z.object({ ok: z.literal(true), data: z.object({
                          updated: z.number(), failed: z.number().optional(),
                          min: z.number(), max: z.number(), max_exp: z.number(),
                          distribution: z.record(z.number()),
                          errors: z.array(z.string()).optional(),
                        })}),
                        { method: "POST", body: JSON.stringify({}) },
                      );
                      const d = (res as any).data;
                      toast.success(`Updated ${d.updated} WNBA salaries (${d.min}–${d.max}M, max EXP=${d.max_exp})`);
                    } catch (e: any) {
                      toast.error(`Salary recalc failed: ${e?.message ?? e}`);
                    }
                  }}
                >
                  Recalculate WNBA Salaries
                </Button>
              </div>
              <div className="flex items-start gap-3 pt-3 border-t border-amber-500/20">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-amber-300">
                    Season-to-Date Performance Backfill
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Rebases every WNBA salary using season FP/G vs league average
                    (max <strong>±20%</strong> from current EXP-based value, bounded
                    $4.5M–$25M). Skips players with 0 GP. Idempotent per day.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    if (!confirm(
                      "Overwrite all WNBA salaries based on season-to-date performance?",
                    )) return;
                    try {
                      const res = await apiFetch(
                        "wnba-salary-season-backfill",
                        z.object({ ok: z.literal(true), data: z.object({
                          change_date: z.string(),
                          league_avg_fp_pg: z.number(),
                          players_total: z.number(),
                          players_changed: z.number(),
                        })}),
                        { method: "POST", body: JSON.stringify({}) },
                      );
                      const d = (res as any).data;
                      toast.success(
                        `Backfilled ${d.players_changed}/${d.players_total} WNBA salaries (avg ${d.league_avg_fp_pg} FP)`,
                      );
                    } catch (e: any) {
                      toast.error(`Season backfill failed: ${e?.message ?? e}`);
                    }
                  }}
                >
                  Run Season Backfill
                </Button>
              </div>
              <div className="pt-3 border-t border-amber-500/20">
                <SalaryAutoSchedulePanel />
              </div>
            </div>
          )}
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
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
              <strong>Replace scope:</strong> this will replace only <strong>{leagueCode.toUpperCase()}</strong> players. The other league's data will not be touched.
            </div>
            {playerValidation && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                <div className="font-heading uppercase text-muted-foreground">Validation</div>
                <div>Rows parsed: <strong>{playerValidation.rowCount}</strong>{playerValidation.expectedRows ? <span className="text-muted-foreground"> (expected ~{playerValidation.expectedRows})</span> : null}</div>
                <div>Detected teams ({playerValidation.detectedTeams.length}): <span className="font-mono">{playerValidation.detectedTeams.join(", ") || "—"}</span></div>
                {playerValidation.unknownTeams.length > 0 && (
                  <div className="text-destructive">Unknown teams: <span className="font-mono">{playerValidation.unknownTeams.join(", ")}</span></div>
                )}
                {playerValidation.duplicateIds.length > 0 && (
                  <div className="text-destructive">Duplicate IDs: {playerValidation.duplicateIds.join(", ")}</div>
                )}
                {playerValidation.invalidFcBc.length > 0 && (
                  <div className="text-destructive">Invalid FC_BC ({playerValidation.invalidFcBc.length}): {playerValidation.invalidFcBc.join(", ")}</div>
                )}
                {playerValidation.blankName.length > 0 && (
                  <div className="text-destructive">Blank NAME for IDs: {playerValidation.blankName.join(", ")}</div>
                )}
                {playerValidation.badDob.length > 0 && (
                  <div className="text-amber-300">Unparseable DOB for IDs: {playerValidation.badDob.join(", ")}</div>
                )}
                {playerValidation.blockers.length > 0 ? (
                  <div className="mt-1 text-destructive font-bold">⛔ Import blocked: {playerValidation.blockers.join(" · ")}</div>
                ) : (
                  <div className="mt-1 text-emerald-400 font-bold">✅ Validation passed</div>
                )}
              </div>
            )}
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
                disabled={isUploading || (playerValidation?.blockers.length ?? 0) > 0}
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

          {/* Advanced Player Stats Import Card */}
          <div className="bg-card border rounded-lg overflow-hidden">
            <div className="section-bar flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Import Player Advanced Stats
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                CSV/TSV: ID, NAME, TEAM, FGM, FGA, FG_PCT, 3PM, 3PA, 3P_PCT, FTM, FTA, FT_PCT, OREB, DREB, TOV, PF, PLUS_MINUS — season-to-date accumulated totals (re-import any time during the Regular Season; values reflect totals through the latest imported game day).
              </p>
              <div className="flex items-center gap-2">
                <Switch id="replace-adv" checked={replaceAdv} onCheckedChange={setReplaceAdv} />
                <Label htmlFor="replace-adv" className="text-sm">
                  Full replace <span className="text-muted-foreground">(NULL stats only for selected-league players not in file)</span>
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
        </TabsContent>

        <TabsContent value="game-data" className="space-y-6 mt-0">
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

      {schedulePreview && scheduleValidation && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="section-bar flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Schedule Preview — Validate Before Import
          </div>
          <div className="p-4 space-y-3 text-xs">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-amber-200">
              <strong>Replace scope:</strong> this will replace only <strong>{leagueCode.toUpperCase()}</strong> schedule. The other league's data will not be touched.
            </div>
            <div className="rounded-md border bg-muted/30 p-3 space-y-1">
              <div className="font-heading uppercase text-muted-foreground">Validation</div>
              <div>Rows: <strong>{scheduleValidation.rowCount}</strong>{scheduleValidation.expectedRows ? <span className="text-muted-foreground"> (expected {scheduleValidation.expectedRows})</span> : null}</div>
              <div>Detected teams ({scheduleValidation.detectedTeams.length}{scheduleValidation.expectedTeams ? `/${scheduleValidation.expectedTeams}` : ""}): <span className="font-mono">{scheduleValidation.detectedTeams.join(", ") || "—"}</span></div>
              {scheduleValidation.expectedPerTeam && (() => {
                const offenders = Object.entries(scheduleValidation.perTeamCounts)
                  .filter(([, n]) => n !== scheduleValidation.expectedPerTeam)
                  .map(([t, n]) => `${t}:${n}`);
                return offenders.length > 0 ? (
                  <div className="text-amber-300">Teams not at expected {scheduleValidation.expectedPerTeam} games: {offenders.join(", ")}</div>
                ) : (
                  <div className="text-emerald-400">All teams at exactly {scheduleValidation.expectedPerTeam} games ✓</div>
                );
              })()}
              {scheduleValidation.unknownTeams.length > 0 && (
                <div className="text-destructive">Unknown team codes: <span className="font-mono">{scheduleValidation.unknownTeams.join(", ")}</span></div>
              )}
              {scheduleValidation.duplicateGameIds.length > 0 && (
                <div className="text-destructive">Duplicate Game IDs: {scheduleValidation.duplicateGameIds.join(", ")}</div>
              )}
              {scheduleValidation.blockers.length > 0 ? (
                <div className="mt-1 text-destructive font-bold">⛔ Import blocked: {scheduleValidation.blockers.join(" · ")}</div>
              ) : (
                <div className="mt-1 text-emerald-400 font-bold">✅ Validation passed</div>
              )}
            </div>
            <div className="overflow-auto max-h-[240px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GW</TableHead><TableHead>Day</TableHead>
                    <TableHead>Date</TableHead><TableHead>Time</TableHead>
                    <TableHead>Home</TableHead><TableHead>Away</TableHead>
                    <TableHead>Game ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedulePreview.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.gw}</TableCell>
                      <TableCell>{r.day}</TableCell>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.time}</TableCell>
                      <TableCell className="font-mono">{r.home_team}</TableCell>
                      <TableCell className="font-mono">{r.away_team}</TableCell>
                      <TableCell className="font-mono text-[10px]">{r.game_id}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleConfirmScheduleImport}
                disabled={isImportingSchedule || scheduleValidation.blockers.length > 0}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isImportingSchedule ? "Importing…" : `Confirm Import (${schedulePendingPayload?.length ?? 0} games)`}
              </Button>
              <Button onClick={handleCancelSchedulePreview} variant="outline">Cancel</Button>
            </div>
          </div>
        </div>
      )}
        </TabsContent>

        <TabsContent value="sync" className="space-y-6 mt-0">
          {/* YouTube Recaps */}
      <div className="bg-card border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Youtube className="h-5 w-5 text-destructive" />
          <h3 className="font-heading font-bold text-lg uppercase">YouTube Recaps</h3>
        </div>
        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong className="text-foreground">Populate YouTube Recaps</strong> — fills in recap video IDs for FINAL games that don't have one yet. Existing IDs are <em>never</em> touched. Run this daily until <code>Remaining</code> reaches 0.</p>
          <p><strong className="text-foreground">Re-scan All Recaps</strong> — re-searches every FINAL game using the latest source (GAMETIME HIGHLIGHTS for NBA, official @WNBA for WNBA) and overwrites the recap id <em>only when a new match is found</em>. Stale IDs without a replacement stay intact, so you can never lose recaps you already have.</p>
          <p className="text-xs">YouTube Data API gives ~10,000 quota units/day → ≈100 game lookups per day. With 1,000+ games a full pass takes several days; just run Populate again tomorrow to continue. Request a quota increase in Google Cloud Console if you need it faster.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Button
            onClick={() => handleYoutubeRecapLookup(false)}
            disabled={isLookingUpRecaps}
          >
            <Youtube className="h-4 w-4 mr-2" />
            {isLookingUpRecaps ? "Looking up recaps…" : "Populate YouTube Recaps"}
          </Button>
          <Button
            onClick={() => {
              const ok = window.prompt(
                "Re-scan replaces recap IDs in place — never wipes them blindly, but it will burn YouTube quota fast (~100 games/day max).\n\nType RESCAN to continue:",
              );
              if (ok && ok.trim().toUpperCase() === "RESCAN") {
                handleYoutubeRecapLookup(true);
              }
            }}
            disabled={isLookingUpRecaps}
            variant="outline"
          >
            <Youtube className="h-4 w-4 mr-2" />
            Re-scan All Recaps
          </Button>
        </div>
        {recapProgress.phase !== "idle" && (
          <div className="space-y-1.5">
            <Progress
              value={
                recapProgress.processed + recapProgress.remaining > 0
                  ? (recapProgress.processed / (recapProgress.processed + recapProgress.remaining)) * 100
                  : recapProgress.phase === "done" ? 100 : 0
              }
              className="h-2"
            />
            <div className="flex items-center gap-2 text-xs">
              {recapProgress.phase === "running" ? (
                <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              )}
              <span className="text-muted-foreground">
                {recapProgress.mode === "rescan" ? "Re-scan" : "Populate"} · Batch {recapProgress.batches} · Checked <strong className="text-foreground">{recapProgress.processed}</strong> · Found <strong className="text-foreground">{recapProgress.found}</strong> · Remaining <strong className="text-foreground">{recapProgress.remaining}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      <MissingRecapsPanel league={leagueCode} />

      {leagueCode === "wnba" && <WnbaSheetSyncPanel />}
      {leagueCode === "euroleague" && <EuroleagueSheetSyncPanel />}
        </TabsContent>
      </Tabs>

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
    </CommissionerAccessGate>
  );
}
