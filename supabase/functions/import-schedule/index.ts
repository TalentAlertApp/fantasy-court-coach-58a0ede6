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
    const { rows, replace } = body;
    if (!rows || !Array.isArray(rows)) {
      return errorResponse("INVALID_INPUT", "rows array is required");
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (replace) {
      await sb.from("schedule_games").delete().neq("game_id", "___none___");
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

        const tipoff_utc = isoDate && normTime
          ? `${isoDate}T${normTime}:00+00:00`
          : isoDate
            ? `${isoDate}T00:00:00+00:00`
            : null;

        games.push({
          game_id: row.game_id,
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
      games_imported: imported,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    return errorResponse("INTERNAL", (e as Error).message, null, 500);
  }
});
