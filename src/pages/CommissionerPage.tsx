import { useState, useRef } from "react";
import { Upload, Download, Users, AlertCircle, CheckCircle2, Database } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiFetch, importGameData } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

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

/** Parse salary like "22,0" or "4,5" → 22.0 or 4.5 (comma = decimal) */
function parseSalary(raw: string): number {
  if (!raw || raw.trim() === "") return 0;
  // Replace comma with dot for decimal
  const cleaned = raw.trim().replace(",", ".");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function parseTsv(text: string): TsvPlayer[] {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  // Remove BOM if present
  const firstLine = lines[0].replace(/^\uFEFF/, "");
  const header = firstLine.split("\t").map(h => h.trim().toUpperCase());

  const colMap: Record<string, number> = {};
  header.forEach((h, i) => { colMap[h] = i; });

  const players: TsvPlayer[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const id = cols[colMap["ID"]]?.trim();
    if (!id) continue;

    players.push({
      nba_url: cols[colMap["URL"]]?.trim() || "",
      id,
      photo: cols[colMap["PHOTO"]]?.trim() || "",
      name: cols[colMap["NAME"]]?.trim() || "",
      team: cols[colMap["TEAM"]]?.trim() || "",
      fc_bc: cols[colMap["FC_BC"]]?.trim() || "FC",
      salary: cols[colMap["$"]]?.trim() || "0",
      jersey: cols[colMap["#"]]?.trim() || "0",
      college: cols[colMap["COLLEGE"]]?.trim() || "",
      weight: cols[colMap["WEIGHT"]]?.trim() || "0",
      height: cols[colMap["HEIGHT"]]?.trim() || "",
      age: cols[colMap["AGE"]]?.trim() || "0",
      dob: cols[colMap["DOB"]]?.trim() || "",
      exp: cols[colMap["EXP"]]?.trim() || "0",
      pos: cols[colMap["POS"]]?.trim() || "",
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
  const [lastResult, setLastResult] = useState<{ upserted: number; total: number; deleted?: number } | null>(null);
  const [lastGameResult, setLastGameResult] = useState<{ games: number; logs: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const gameFileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setLastResult(null);
    try {
      const text = await file.text();
      const players = parseTsv(text);

      if (players.length === 0) {
        toast.error("No valid players found in TSV file");
        return;
      }

      // Map salary before sending
      const payload = players.map(p => ({
        ...p,
        salary: parseSalary(p.salary),
      }));

      const result = await apiFetch("import-players", ImportResponseSchema, {
        method: "POST",
        body: JSON.stringify({ players: payload, replace: true }),
      });

      if (result.ok) {
        setLastResult({ upserted: result.data.upserted, total: result.data.total, deleted: result.data.deleted });
        toast.success(`Imported ${result.data.upserted} players`);
        if (result.data.errors?.length) {
          toast.warning(`${result.data.errors.length} errors during import`);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Import failed: ${msg}`);
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
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
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) {
        toast.error("No valid game data found");
        return;
      }

      // Detect delimiter: if the header contains tabs, use TSV; otherwise CSV
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
              onChange={handleUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? "Importing…" : "Upload TSV"}
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
        </div>
      </div>
    </div>
  );
}
