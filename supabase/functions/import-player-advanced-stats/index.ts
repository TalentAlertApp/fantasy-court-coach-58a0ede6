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
function err(code: string, message: string, status = 400) {
  return new Response(
    JSON.stringify({ ok: false, data: null, error: { code, message, details: null } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function toIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : null;
}
function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = typeof v === "number" ? String(v) : String(v).trim().replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Body shape:
 * {
 *   rows: Array<{ id: number, fgm, fga, fg_pct, tpm, tpa, tp_pct, ftm, fta, ft_pct, oreb, dreb, tov, pf, plus_minus }>,
 *   replace?: boolean   // when true, NULL out the 14 columns for any player NOT in `rows`
 * }
 */
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authFail = requireAdmin(req);
  if (authFail) return authFail;

  try {
    if (req.method !== "POST") return err("METHOD_NOT_ALLOWED", "POST only", 405);

    const body = await req.json().catch(() => null);
    const rows = Array.isArray(body?.rows) ? body.rows : null;
    const replace = !!body?.replace;
    if (!rows || rows.length === 0) {
      return err("INVALID_INPUT", "rows array required");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const importedIds = new Set<number>();
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Batch upsert in chunks of 50.
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const upsertRows = batch
        .map((r: any) => {
          const id = toIntOrNull(r.id);
          if (!id || id <= 0) return null;
          importedIds.add(id);
          return {
            id,
            fgm: toIntOrNull(r.fgm),
            fga: toIntOrNull(r.fga),
            fg_pct: toNumOrNull(r.fg_pct),
            tpm: toIntOrNull(r.tpm),
            tpa: toIntOrNull(r.tpa),
            tp_pct: toNumOrNull(r.tp_pct),
            ftm: toIntOrNull(r.ftm),
            fta: toIntOrNull(r.fta),
            ft_pct: toNumOrNull(r.ft_pct),
            oreb: toIntOrNull(r.oreb),
            dreb: toIntOrNull(r.dreb),
            tov: toIntOrNull(r.tov),
            pf: toIntOrNull(r.pf),
            plus_minus: toIntOrNull(r.plus_minus),
            updated_at: new Date().toISOString(),
          };
        })
        .filter((r: any) => r !== null);

      if (upsertRows.length === 0) {
        skipped += batch.length;
        continue;
      }

      // Upsert against existing player rows. We do NOT insert new players —
      // if an id doesn't exist in `players`, the upsert would create a row
      // with NULL name/team etc. So we use update-only by filtering to ids
      // we know exist. Cheaper: trust the data, use upsert with onConflict,
      // and rely on the import-players workflow as the source of truth for
      // player creation. Practical compromise: do an UPDATE per id (Supabase
      // doesn't have a clean "update only matching" bulk op).
      // For ~600 rows this is fine; we batch via Promise.all.
      const results = await Promise.all(
        upsertRows.map(async (row: any) => {
          const { id, ...patch } = row;
          const { data, error } = await supabase
            .from("players")
            .update(patch)
            .eq("id", id)
            .select("id");
          if (error) {
            errors.push(`id=${id}: ${error.message}`);
            return false;
          }
          return (data?.length ?? 0) > 0;
        }),
      );
      updated += results.filter(Boolean).length;
      skipped += results.filter((r) => !r).length;
    }

    // Replace mode: NULL the 14 columns for players NOT in the import.
    let nulledOut = 0;
    if (replace) {
      const { data: allIds, error: allIdsErr } = await supabase
        .from("players")
        .select("id");
      if (allIdsErr) {
        errors.push(`load all ids: ${allIdsErr.message}`);
      } else {
        const targets = (allIds ?? [])
          .map((r: any) => r.id as number)
          .filter((id: number) => !importedIds.has(id));
        // Chunk the IN clause to avoid URL length limits.
        for (let i = 0; i < targets.length; i += 200) {
          const chunk = targets.slice(i, i + 200);
          const { error } = await supabase
            .from("players")
            .update({
              fgm: null, fga: null, fg_pct: null,
              tpm: null, tpa: null, tp_pct: null,
              ftm: null, fta: null, ft_pct: null,
              oreb: null, dreb: null, tov: null,
              pf: null, plus_minus: null,
              updated_at: new Date().toISOString(),
            })
            .in("id", chunk);
          if (error) {
            errors.push(`null-out batch ${i}: ${error.message}`);
          } else {
            nulledOut += chunk.length;
          }
        }
      }
    }

    return ok({
      updated,
      skipped,
      nulled_out: nulledOut,
      total: rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    console.error("import-player-advanced-stats error:", e);
    return err("IMPORT_ERROR", e instanceof Error ? e.message : "Unknown", 500);
  }
});
