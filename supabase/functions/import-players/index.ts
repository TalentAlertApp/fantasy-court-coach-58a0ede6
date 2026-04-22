import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { requireAdmin } from "../_shared/admin-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function ok(data: unknown) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(code: string, message: string, details: string | null = null, status = 400) {
  return new Response(
    JSON.stringify({ ok: false, data: null, error: { code, message, details } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function calcAge(dobStr: string | null): number {
  if (!dobStr) return 0;
  try {
    const d = new Date(dobStr);
    if (isNaN(d.getTime())) return 0;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
  } catch {
    return 0;
  }
}

function normDob(v: string | null | undefined): string | null {
  if (!v || v.trim() === "" || v === "None") return null;
  const t = v.trim().replace(/^"|"$/g, "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const parts = t.split("/");
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (parseInt(a) > 12) {
      return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
    }
    return `${c}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
  }
  return null;
}

/** Check if a name looks corrupted — contains literal ? where diacritics should be */
function looksCorrupted(name: string): boolean {
  return /\?/.test(name);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") return err("METHOD_NOT_ALLOWED", "POST only", null, 405);

    const { players, replace } = await req.json();
    if (!Array.isArray(players) || players.length === 0) {
      return err("INVALID_INPUT", "players array required");
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Load existing names for corruption protection
    let existingNames: Record<number, string> = {};
    if (replace) {
      // Before deleting, grab existing clean names as backup
      const { data: existing } = await supabase
        .from("players")
        .select("id, name")
        .limit(2000);
      if (existing) {
        for (const p of existing) {
          if (!looksCorrupted(p.name)) {
            existingNames[p.id] = p.name;
          }
        }
      }
      console.log(`Loaded ${Object.keys(existingNames).length} clean existing names as backup`);
    }

    let deleted = 0;
    if (replace) {
      const { data: delData, error: delErr } = await supabase
        .from("players")
        .delete()
        .neq("id", 0)
        .select("id");
      if (delErr) {
        console.error("Delete all error:", delErr);
      } else {
        deleted = delData?.length || 0;
        console.log(`Deleted ${deleted} existing players`);
      }
    }

    let upserted = 0;
    let skipped = 0;
    let nameProtected = 0;
    const errors: string[] = [];

    for (let i = 0; i < players.length; i += 50) {
      const batch = players.slice(i, i + 50);
      const rows = batch.map((p: any) => {
        const dob = normDob(p.dob);
        const age = calcAge(dob) || (parseInt(p.age) || 0);
        const college = (p.college === "None" || !p.college) ? null : p.college;
        const salRaw = String(p.salary ?? "0").replace(/^"|"$/g, "").replace(",", ".");
        const salary = typeof p.salary === "number" ? p.salary : (parseFloat(salRaw) || 0);

        let name = p.name;
        const playerId = parseInt(p.id);

        // If incoming name looks corrupted but we have a clean backup, use the backup
        if (looksCorrupted(name) && existingNames[playerId]) {
          console.log(`Protected name for ID ${playerId}: "${name}" → "${existingNames[playerId]}"`);
          name = existingNames[playerId];
          nameProtected++;
        }

        return {
          id: playerId,
          nba_url: p.nba_url || null,
          name,
          team: p.team ?? "",
          fc_bc: (p.fc_bc || "FC").toUpperCase(),
          photo: p.photo || null,
          salary,
          jersey: parseInt(p.jersey) || 0,
          college,
          weight: parseInt(p.weight) || 0,
          height: p.height || null,
          age,
          dob,
          exp: parseInt(p.exp) || 0,
          pos: p.pos || null,
          updated_at: new Date().toISOString(),
        };
      }).filter((r: { id: number }) => r.id > 0);

      if (rows.length === 0) { skipped += batch.length; continue; }

      const { error } = await supabase.from("players").upsert(rows, { onConflict: "id" });

      if (error) {
        errors.push(`Batch ${i}: ${error.message}`);
        console.error("Import error:", error);
      } else {
        upserted += rows.length;
      }
    }

    if (nameProtected > 0) {
      console.log(`Protected ${nameProtected} names from corruption`);
    }

    return ok({
      upserted,
      skipped,
      deleted,
      nameProtected,
      total: players.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("Import error:", e);
    return err("IMPORT_ERROR", e instanceof Error ? e.message : "Unknown error", null, 500);
  }
});
