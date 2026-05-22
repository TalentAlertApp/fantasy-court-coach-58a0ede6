// Shared league resolution. league_code arrives via querystring OR JSON body.
// Returns { league_id, league_code }. Unknown codes are rejected — NEVER
// silently coerced — so a typo in the client surfaces as a clear error
// instead of returning NBA data by accident.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { isKnownCompetition } from "./competitions.ts";

export type LeagueCode = "nba" | "wnba" | "euroleague";

export function readLeagueCodeFromUrl(url: URL): LeagueCode {
  const v = (url.searchParams.get("league_code") ?? "nba").toLowerCase();
  return isKnownCompetition(v) ? v : "nba";
}

export function readLeagueCodeFromBody(body: Record<string, unknown> | null | undefined): LeagueCode {
  const v = String((body && (body as any).league_code) ?? "nba").toLowerCase();
  return isKnownCompetition(v) ? v : "nba";
}

/** Strict variant — throws on unknown codes. Use at the edge of a function
 *  when you want to reject typos instead of defaulting to NBA. */
export function assertLeagueCodeFromUrl(url: URL): LeagueCode {
  const raw = url.searchParams.get("league_code");
  if (raw == null) return "nba";
  const v = raw.toLowerCase();
  if (!isKnownCompetition(v)) throw new Error(`Unknown league_code: ${raw}`);
  return v;
}

const _cache = new Map<LeagueCode, string>();

export async function resolveLeagueId(sb: SupabaseClient, code: LeagueCode): Promise<string> {
  const hit = _cache.get(code);
  if (hit) return hit;
  const { data, error } = await sb.from("leagues").select("id").eq("code", code).maybeSingle();
  if (error || !data?.id) throw new Error(`League '${code}' not found`);
  _cache.set(code, data.id as string);
  return data.id as string;
}
