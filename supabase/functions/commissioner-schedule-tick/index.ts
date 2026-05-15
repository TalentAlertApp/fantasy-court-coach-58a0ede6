import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";

/**
 * Tick endpoint invoked every minute by pg_cron (and manually testable from
 * /commissioner). Reads commissioner_sync_schedules, and for each enabled row
 * whose Lisbon HH:MM matches the current minute (and that hasn't already been
 * run in the same Lisbon minute), invokes the WNBA sync sequence + optional
 * YouTube recap lookup.
 *
 * Auth: accepts either x-admin-secret (manual) OR a Bearer token equal to
 * the SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY (used by pg_cron via
 * net.http_post — pg_cron only has the anon key available without vault).
 * The `?force=` override additionally requires x-admin-secret to prevent
 * unauthenticated callers from triggering on-demand sync runs.
 */

function authorize(req: Request, allowAnon: boolean): Response | null {
  const adminSecret = Deno.env.get("ADMIN_API_SECRET");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const got = req.headers.get("x-admin-secret") ?? "";
  if (adminSecret && got && got === adminSecret) return null;
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (serviceRole && bearer && bearer === serviceRole) return null;
  const apikey = req.headers.get("apikey") ?? "";
  if (allowAnon && anonKey && (bearer === anonKey || apikey === anonKey)) return null;
  return errorResponse("UNAUTHORIZED", "Missing or invalid credentials", null, 401);
}

function nowLisbon(): { hhmm: string; minuteKey: string } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date())
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  const hhmm = `${parts.hour}:${parts.minute}`;
  const minuteKey = `${parts.year}-${parts.month}-${parts.day} ${hhmm}`;
  return { hhmm, minuteKey };
}

async function callFn(name: string, body: Record<string, unknown> | null) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "x-admin-secret": Deno.env.get("ADMIN_API_SECRET") ?? "",
    },
    body: body ? JSON.stringify(body) : "{}",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${text.slice(0, 200)}`);
  try {
    const json = JSON.parse(text);
    if (json && json.ok === false) {
      throw new Error(`${name}: ${json.error?.message ?? "failed"}`);
    }
    return json;
  } catch {
    return { raw: text };
  }
}

async function runJob(jobKey: string, includeRecaps: boolean) {
  if (jobKey === "sync3") {
    await callFn("wnba-sheet-sync", { mode: "schedule" });
    await callFn("wnba-sheet-sync", { mode: "game-data" });
    await callFn("wnba-sheet-sync", { mode: "advanced-stats" });
  } else if (jobKey === "all") {
    await callFn("wnba-sheet-sync", { mode: "all" });
  } else {
    throw new Error(`Unknown job_key '${jobKey}'`);
  }
  if (includeRecaps) {
    // youtube-recap-lookup uses query params, ?limit=200
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/youtube-recap-lookup?limit=200`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`youtube-recap-lookup: HTTP ${res.status} ${t.slice(0, 200)}`);
    }
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Manual override: ?force=sync3 / ?force=all runs that job immediately,
  // ignoring time/enabled. Only allowed with admin-secret/service-role —
  // anon callers (pg_cron) can only run scheduled ticks.
  const url = new URL(req.url);
  const force = url.searchParams.get("force");
  const includeRecapsQS = url.searchParams.get("recaps") === "1";

  const authFail = authorize(req, /* allowAnon */ !force);
  if (authFail) return authFail;

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { hhmm, minuteKey } = nowLisbon();
  const ran: Array<{ job_key: string; status: string; error?: string }> = [];

  try {
    const { data: schedules, error } = await sb
      .from("commissioner_sync_schedules")
      .select("*");
    if (error) throw error;

    for (const row of schedules ?? []) {
      const isForce = force && force === row.job_key;
      if (!isForce) {
        if (!row.enabled) continue;
        if (row.run_time_lisbon !== hhmm) continue;
        // Same-minute dedupe.
        if (row.last_run_at) {
          const prevKey = (() => {
            const d = new Date(row.last_run_at);
            const f = new Intl.DateTimeFormat("en-GB", {
              timeZone: "Europe/Lisbon",
              year: "numeric", month: "2-digit", day: "2-digit",
              hour: "2-digit", minute: "2-digit", hour12: false,
            });
            const p = Object.fromEntries(
              f.formatToParts(d).filter((x) => x.type !== "literal").map((x) => [x.type, x.value]),
            );
            return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
          })();
          if (prevKey === minuteKey) continue;
        }
      }

      try {
        await runJob(row.job_key, isForce ? includeRecapsQS || row.include_recaps : row.include_recaps);
        await sb.from("commissioner_sync_schedules")
          .update({ last_run_at: new Date().toISOString(), last_status: "ok", last_error: null })
          .eq("job_key", row.job_key);
        ran.push({ job_key: row.job_key, status: "ok" });
      } catch (jobErr) {
        const msg = (jobErr as Error).message;
        await sb.from("commissioner_sync_schedules")
          .update({ last_run_at: new Date().toISOString(), last_status: "error", last_error: msg })
          .eq("job_key", row.job_key);
        ran.push({ job_key: row.job_key, status: "error", error: msg });
      }
    }

    return okResponse({ now_lisbon: hhmm, ran });
  } catch (e) {
    return errorResponse("INTERNAL", (e as Error).message, null, 500);
  }
});