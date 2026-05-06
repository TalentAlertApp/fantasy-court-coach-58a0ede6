// Shared league resolution. league_code arrives via querystring OR JSON body.
// Returns { league_id, league_code }.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

export type LeagueCode = "nba" | "wnba";

export function readLeagueCodeFromUrl(url: URL): LeagueCode {
  const v = (url.searchParams.get("league_code") ?? "nba").toLowerCase();
  return v === "wnba" ? "wnba" : "nba";
}

export function readLeagueCodeFromBody(body: Record<string, unknown> | null | undefined): LeagueCode {
  const v = String((body && (body as any).league_code) ?? "nba").toLowerCase();
  return v === "wnba" ? "wnba" : "nba";
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
