import { useState, useRef } from "react";
import { Upload, Download, Users, AlertCircle, CheckCircle2, Database, Eye } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiFetch, importGameData } from "@/lib/api";
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
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isImportingGames, setIsImportingGames] = useState(false);
  const [replaceGames, setReplaceGames] = useState(true);
  const [encoding, setEncoding] = useState<Encoding>("auto");
  const [lastResult, setLastResult] = useState<{ upserted: number; total: number; deleted?: number } | null>(null);
  const [lastGameResult, setLastGameResult] = useState<{ games: number; logs: number } | null>(null);
  const [preview, setPreview] = useState<TsvPlayer[] | null>(null);
  const [pendingPayload, setPendingPayload] = useState<any[] | null>(null);
  const [corruptCount, setCorruptCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const gameFileRef = useRef<HTMLInputElement>(null);

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

  const handleGameDataUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingGames(true);
    setLastGameResult(null);
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

      const result = await importGameData(rows, replaceGames);
      setLastGameResult({ games: result.games_imported, logs: result.player_logs_imported });
      toast.success(`Imported ${result.games_imported} games, ${result.player_logs_imported} player logs`);

      if (result.errors?.length) {
        toast.warning(`${result.errors.length} errors during import`);
        console.warn("Import errors:", result.errors);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Game data import failed: ${msg}`);
    } finally {
      setIsImportingGames(false);
      if (gameFileRef.current) gameFileRef.current.value = "";
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
        <div className="bg-card border rounded-sm overflow-hidden">
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
        <div className="bg-card border rounded-sm overflow-hidden">
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
        <div className="bg-card border rounded-sm overflow-hidden">
          <div className="section-bar flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview — Verify Names Before Import
          </div>
          <div className="p-4 space-y-3">
            {corruptCount > 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-sm p-2">
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
      <div className="bg-card border rounded-sm overflow-hidden">
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
            {isImportingGames ? "Importing…" : "Upload Game Data"}
          </Button>

          {lastGameResult && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" />
              {lastGameResult.games} games, {lastGameResult.logs} player logs imported
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 bg-muted/50 border rounded-sm p-3">
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
