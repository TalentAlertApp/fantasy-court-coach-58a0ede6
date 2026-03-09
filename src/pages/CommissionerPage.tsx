import { useState, useRef } from "react";
import { Upload, Download, Users, AlertCircle, CheckCircle2, Database } from "lucide-react";
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
    total: z.number(),
    errors: z.array(z.string()).optional(),
  }),
});

interface CsvPlayer {
  id: string;
  photo: string;
  name: string;
  team: string;
  fc_bc: string;
  jersey: string;
  college: string;
  weight: string;
  height: string;
  age: string;
  dob: string;
  exp: string;
  pos: string;
}

function parseCsv(text: string): CsvPlayer[] {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  
  // Parse header
  const header = parseCSVLine(lines[0]).map(h => h.trim().toUpperCase());
  
  const colMap: Record<string, number> = {};
  header.forEach((h, i) => { colMap[h] = i; });

  const players: CsvPlayer[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (!cols[colMap["ID"]]) continue;

    players.push({
      id: cols[colMap["ID"]] || "",
      photo: cols[colMap["PHOTO"]] || "",
      name: cols[colMap["NAME"]] || "",
      team: cols[colMap["TEAM"]] || "",
      fc_bc: cols[colMap["FC_BC"]] || "FC",
      jersey: cols[colMap["#"]] || "0",
      college: cols[colMap["COLLEGE"]] || "",
      weight: cols[colMap["WEIGHT"]] || "0",
      height: cols[colMap["HEIGHT"]] || "",
      age: cols[colMap["AGE"]] || "0",
      dob: cols[colMap["DOB"]] || "",
      exp: cols[colMap["EXP"]] || "0",
      pos: cols[colMap["POS"]] || "",
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
  const [lastResult, setLastResult] = useState<{ upserted: number; total: number } | null>(null);
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
      const players = parseCsv(text);

      if (players.length === 0) {
        toast.error("No valid players found in CSV");
        return;
      }

      const result = await apiFetch("import-players", ImportResponseSchema, {
        method: "POST",
        body: JSON.stringify({ players, replace: true }),
      });

      if (result.ok) {
        setLastResult({ upserted: result.data.upserted, total: result.data.total });
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
        .select("id, photo, name, team, fc_bc, jersey, college, weight, height, age, dob, exp, pos")
        .order("name");

      if (error) throw new Error(error.message);
      if (!players?.length) {
        toast.warning("No players to export");
        return;
      }

      const header = "ID,PHOTO,NAME,TEAM,FC_BC,#,COLLEGE,WEIGHT,HEIGHT,AGE,DOB,EXP,POS";
      const rows = players.map(p => {
        const escapeCsv = (v: string | number | null) => {
          const s = String(v ?? "");
          return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        };
        return [p.id, p.photo, p.name, p.team, p.fc_bc, p.jersey, p.college,
          p.weight, p.height, p.age, p.dob, p.exp, p.pos].map(escapeCsv).join(",");
      });

      const csv = [header, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `players_${new Date().toISOString().split("T")[0]}.csv`;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-heading font-bold">Commissioner</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Manage the player database. Upload a CSV to update bio data (photo, team, position, DOB, etc.).
        This will <strong>never</strong> overwrite salary or stats — only static player information.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upload Card */}
        <div className="bg-card border rounded-sm overflow-hidden">
          <div className="section-bar">Upload Player Database</div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              CSV format: ID, PHOTO, NAME, TEAM, FC_BC, #, COLLEGE, WEIGHT, HEIGHT, AGE, DOB, EXP, POS
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? "Importing…" : "Upload CSV"}
            </Button>

            {lastResult && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" />
                {lastResult.upserted} / {lastResult.total} players imported
              </div>
            )}
          </div>
        </div>

        {/* Download Card */}
        <div className="bg-card border rounded-sm overflow-hidden">
          <div className="section-bar">Download Player Database</div>
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Export current player bio data as CSV. Includes all players in the database.
            </p>
            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              variant="outline"
              className="w-full"
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? "Exporting…" : "Download CSV"}
            </Button>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 bg-muted/50 border rounded-sm p-3">
        <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Age</strong> is automatically calculated from DOB on import.</p>
          <p><strong>New players</strong> (IDs not in DB) will be created. Existing players will have bio fields updated.</p>
          <p><strong>Salary, stats, and computed values</strong> are never modified by this import.</p>
        </div>
      </div>
    </div>
  );
}
