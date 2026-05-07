import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { requireAdmin } from "../_shared/admin-guard.ts";

interface ScheduleRow {
  gw: number;
  day: number;
  date: string;
  dayName: string;
  time: string;
  home_team: string;
  away_team: string;
  status: string;
  home_pts: number;
  away_pts: number;
  game_id: string;
  nba_game_url: string | null;
  game_recap_url: string | null;
  game_boxscore_url: string | null;
  game_charts_url: string | null;
  game_playbyplay_url: string | null;
}

function normalizeStatus(raw: string): "FINAL" | "SCHEDULED" {
  const s = (raw || "").trim().toUpperCase();
  return s.startsWith("FINAL") ? "FINAL" : "SCHEDULED";
}

/** Accept YYYY-MM-DD or DD/MM/YYYY → YYYY-MM-DD */
function normalizeDate(raw: string): string | null {
  const v = (raw || "").trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const p = v.split("/");
  if (p.length === 3) return `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
  return null;
}

function normalizeTime(raw: string): string | null {
  let t = (raw || "").trim();
  if (!t) return null;
  t = t.replace(/\s*(UTC|GMT|Z|[+-]\d{1,2}(:\d{2})?)\s*/gi, "").trim();
  const m = t.match(/^(\d{1,2}:\d{2})/);
  if (!m) return null;
  const result = m[1];
  if (/^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(result)) return result;
  return null;
}

/**
 * Convert a wall-clock Lisbon date+time (YYYY-MM-DD, HH:MM) into a true UTC
 * ISO timestamp. Lisbon is UTC+0 (winter) or UTC+1 (summer / WEST). We use
 * the standard JS approach: build "T+00:00", then ask Intl what time that
 * UTC instant looks like in Lisbon, and back-solve the offset.
 */
function lisbonWallClockToUtcIso(date: string, hhmm: string): string {
  // Build the naive wall-clock as if it were UTC, then determine actual offset.
  const naiveUtc = new Date(`${date}T${hhmm}:00Z`);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(naiveUtc).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  // What Lisbon thinks the naive UTC is — diff from the wall clock = offset minutes.
  const lisbonAsMs = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute),
  );
  const offsetMin = (lisbonAsMs - naiveUtc.getTime()) / 60000; // +60 in summer, 0 in winter
  const realUtcMs = naiveUtc.getTime() - offsetMin * 60000;
  return new Date(realUtcMs).toISOString();
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const authFail = requireAdmin(req);
  if (authFail) return authFail;

  try {
    if (req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only POST allowed");
    }

    const body = await req.json();
    const { rows, replace, league_code } = body;
    if (!rows || !Array.isArray(rows)) {
      return errorResponse("INVALID_INPUT", "rows array is required");
    }
    const leagueCode = String(league_code ?? "nba").toLowerCase();
    if (!["nba", "wnba"].includes(leagueCode)) {
      return errorResponse("INVALID_INPUT", `league_code must be 'nba' or 'wnba' (got '${leagueCode}')`);
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: leagueRow, error: leagueErr } = await sb
      .from("leagues").select("id").eq("code", leagueCode).maybeSingle();
    if (leagueErr || !leagueRow?.id) {
      return errorResponse("LEAGUE_NOT_FOUND", `Sport league '${leagueCode}' not found`, leagueErr?.message ?? null, 404);
    }
    const league_id = leagueRow.id as string;

    if (replace) {
      // CRITICAL: only delete schedule rows for THIS league.
      await sb.from("schedule_games").delete().eq("league_id", league_id);
    }

    const games: any[] = [];
    const errors: string[] = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx] as ScheduleRow;
      try {
        if (!row.game_id) {
          errors.push(`Row #${idx + 1}: missing game_id`);
          continue;
        }

        const isoDate = normalizeDate(row.date);
        const normTime = normalizeTime(row.time);
        const status = normalizeStatus(row.status);

        // WNBA TSV times are already Europe/Lisbon wall-clock — convert to UTC.
        // NBA times historically arrive as UTC and stay as-is.
        const tipoff_utc = isoDate && normTime
          ? (leagueCode === "wnba"
              ? lisbonWallClockToUtcIso(isoDate, normTime)
              : `${isoDate}T${normTime}:00+00:00`)
          : isoDate
            ? `${isoDate}T00:00:00+00:00`
            : null;

        games.push({
          game_id: row.game_id,
          league_id,
          gw: row.gw || 1,
          day: row.day || 1,
          tipoff_utc,
          home_team: row.home_team,
          away_team: row.away_team,
          home_pts: row.home_pts || 0,
          away_pts: row.away_pts || 0,
          status,
          nba_game_url: row.nba_game_url || null,
          game_recap_url: row.game_recap_url || null,
          game_boxscore_url: row.game_boxscore_url || null,
          game_charts_url: row.game_charts_url || null,
          game_playbyplay_url: row.game_playbyplay_url || null,
        });
      } catch (rowErr) {
        errors.push(`Row #${idx + 1}: ${(rowErr as Error).message}`);
      }
    }

    // Upsert in batches
    let imported = 0;
    const BATCH = 200;
    for (let i = 0; i < games.length; i += BATCH) {
      const batch = games.slice(i, i + BATCH);
      const { error: upsertErr } = await sb
        .from("schedule_games")
        .upsert(batch, { onConflict: "game_id" });

      if (upsertErr) {
        errors.push(`Batch ${i}: ${upsertErr.message}`);
      } else {
        imported += batch.length;
      }
    }

    return okResponse({
      league_code: leagueCode,
      league_id,
      games_imported: imported,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    return errorResponse("INTERNAL", (e as Error).message, null, 500);
  }
});

/**
 * Fire-and-forget background invocation of the youtube-recap-lookup function so
 * newly imported FINAL games (especially WNBA) get recap IDs populated without
 * extra clicks in /commissioner. Best-effort: failures are swallowed.
 * NOTE: declared but currently called only at top-level by callers that need it
 * — kept here to centralize the URL construction.
 */
async function triggerRecapLookup() {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/youtube-recap-lookup?limit=100`;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
    });
  } catch (_e) { /* best-effort */ }
}
