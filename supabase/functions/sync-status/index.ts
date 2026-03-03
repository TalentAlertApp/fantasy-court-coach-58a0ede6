import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const runId = url.searchParams.get("run_id");

    if (runId) {
      const { data, error } = await sb
        .from("sync_runs")
        .select("*")
        .eq("id", runId)
        .single();
      if (error || !data) return errorResponse("NOT_FOUND", "Run not found", null, 404);
      return okResponse({
        run_id: data.id,
        type: data.type,
        status: data.status,
        started_at: data.started_at,
        finished_at: data.finished_at,
        step: data.details?.step ?? null,
        counts: data.details?.counts ?? {},
        errors: data.details?.errors ?? [],
        source: data.details?.source ?? "nba",
      });
    }

    // Get latest successful run
    const { data: latest } = await sb
      .from("sync_runs")
      .select("*")
      .in("status", ["SUCCESS", "PARTIAL"])
      .order("finished_at", { ascending: false })
      .limit(1)
      .single();

    const lastSuccessAt = latest?.finished_at ?? null;
    const isStale = !lastSuccessAt ||
      (Date.now() - new Date(lastSuccessAt).getTime()) > 2 * 60 * 60 * 1000;

    const durationMs = (latest?.started_at && latest?.finished_at)
      ? new Date(latest.finished_at).getTime() - new Date(latest.started_at).getTime()
      : null;

    return okResponse({
      last_success_at: lastSuccessAt,
      last_type: latest?.type ?? null,
      counts: latest?.details?.counts ?? {},
      is_stale: isStale,
      source: latest?.details?.source ?? null,
      duration_ms: durationMs,
      error_count: (latest?.details?.errors ?? []).length,
      errors: latest?.details?.errors ?? [],
    });
  } catch (e) {
    console.error("[sync-status] Error:", e);
    return errorResponse("STATUS_ERROR", e instanceof Error ? e.message : "Unknown", null, 500);
  }
});
