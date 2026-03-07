import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

// Normalize DOB from various formats to YYYY-MM-DD
function normDob(v: string | null | undefined): string | null {
  if (!v || v.trim() === "" || v === "None") return null;
  const t = v.trim();
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // M/D/YYYY or MM/DD/YYYY
  const parts = t.split("/");
  if (parts.length === 3) {
    const [m, d, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
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

    let upserted = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < players.length; i += 50) {
      const batch = players.slice(i, i + 50);
      // deno-lint-ignore no-explicit-any
      const rows = batch.map((p: any) => {
        const dob = normDob(p.dob);
        const age = calcAge(dob) || (parseInt(p.age) || 0);
        const college = (p.college === "None" || !p.college) ? null : p.college;

        return {
          id: parseInt(p.id),
          name: p.name,
          team: p.team,
          fc_bc: (p.fc_bc || "FC").toUpperCase(),
          photo: p.photo || null,
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

      // Upsert bio fields ONLY - never overwrite salary, stats, or fc_bc if already set
      // Actually, for CSV import we DO want to set fc_bc, team, etc - these are bio fields
      // But we must NOT overwrite salary or computed stats
      // Supabase upsert will overwrite all provided columns, so we need to be careful
      // Solution: use upsert with ignoreDuplicates=false and only include bio columns

      const { error } = await supabase.from("players").upsert(rows, {
        onConflict: "id",
        // This will update all provided columns for existing rows
        // Since we only provide bio fields, stats/salary won't be touched
      });

      if (error) {
        errors.push(`Batch ${i}: ${error.message}`);
        console.error("Import error:", error);
      } else {
        upserted += rows.length;
      }
    }

    // If replace mode, delete players not in the uploaded set
    let deleted = 0;
    if (replace) {
      const validIds = players.map((p: any) => parseInt(p.id)).filter((id: number) => id > 0);
      if (validIds.length > 0) {
        const { data: delData, error: delErr } = await supabase
          .from("players")
          .delete()
          .not("id", "in", `(${validIds.join(",")})`)
          .select("id");
        if (delErr) {
          errors.push(`Delete stale: ${delErr.message}`);
        } else {
          deleted = delData?.length || 0;
        }
      }
    }

    return ok({
      upserted,
      skipped,
      deleted,
      total: players.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("Import error:", e);
    return err("IMPORT_ERROR", e instanceof Error ? e.message : "Unknown error", null, 500);
  }
});
