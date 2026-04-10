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

function normDob(v: string | null | undefined): string | null {
  if (!v || v.trim() === "" || v === "None") return null;
  const t = v.trim().replace(/^"|"$/g, "");
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const parts = t.split("/");
  if (parts.length === 3) {
    const [a, b, c] = parts;
    // If first part > 12, it's DD/MM/YYYY (European)
    if (parseInt(a) > 12) {
      return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
    }
    // Otherwise assume M/D/YYYY (American)
    return `${c}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
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
    const errors: string[] = [];

    for (let i = 0; i < players.length; i += 50) {
      const batch = players.slice(i, i + 50);
      const rows = batch.map((p: any) => {
        const dob = normDob(p.dob);
        const age = calcAge(dob) || (parseInt(p.age) || 0);
        const college = (p.college === "None" || !p.college) ? null : p.college;
        // Strip quotes and handle European comma decimal
        const salRaw = String(p.salary ?? "0").replace(/^"|"$/g, "").replace(",", ".");
        const salary = typeof p.salary === "number" ? p.salary : (parseFloat(salRaw) || 0);

        return {
          id: parseInt(p.id),
          nba_url: p.nba_url || null,
          name: p.name,
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
