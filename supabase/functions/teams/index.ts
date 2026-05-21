import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function leaguesByCode(sb: any): Promise<Record<string, string>> {
  const { data } = await sb.from("leagues").select("id, code");
  const m: Record<string, string> = {};
  for (const r of (data ?? []) as any[]) m[String(r.code)] = String(r.id);
  return m;
}

function codeForLeagueId(byCode: Record<string, string>, id: string | null | undefined): "nba" | "wnba" {
  if (!id) return "nba";
  for (const [code, lid] of Object.entries(byCode)) {
    if (lid === id && (code === "nba" || code === "wnba")) return code as "nba" | "wnba";
  }
  return "nba";
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);
  const teamIdParam = url.searchParams.get("team_id");

  // Resolve the calling user from the Authorization header (if any).
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  let userId: string | null = null;
  if (jwt) {
    try {
      // Use an anon-key client with the user's Authorization header forwarded.
      // The service-role client's getUser(jwt) does not verify asymmetric
      // (ES256) tokens produced by Supabase's signing-keys system.
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data, error } = await userClient.auth.getUser(jwt);
      if (error) {
        console.warn("[teams] auth.getUser error:", error.message);
      } else if (data?.user) {
        userId = data.user.id;
      }
    } catch (e) {
      console.warn("[teams] auth.getUser threw:", (e as Error).message);
    }
  }

  try {
    if (req.method === "GET") {
      // Anonymous → empty list (front-end will redirect to /auth)
      if (!userId) {
        return okResponse({ items: [], default_team_id: null });
      }
      const { data: teams, error } = await sb
        .from("teams")
        .select("*")
        .or(`owner_id.is.null,owner_id.eq.${userId}`)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const byCode = await leaguesByCode(sb);
      const enriched = (teams ?? []).map((t: any) => ({
        ...t,
        league_code: codeForLeagueId(byCode, t.sport_league_id),
      }));
      const defaultTeamId = (teams && teams.length > 0) ? teams[0].id : null;
      return okResponse({ items: enriched, default_team_id: defaultTeamId });
    }

    if (req.method === "POST") {
      if (!userId) return errorResponse("UNAUTHORIZED", "Sign in required");
      const body = await req.json();
      const { name, description, league_code, fantasy_league_id } = body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return errorResponse("VALIDATION", "name is required");
      }
      const byCode = await leaguesByCode(sb);
      const MAIN_LEAGUE_NBA_ID = "00000000-0000-0000-0000-000000000010";
      const MAIN_LEAGUE_WNBA_ID = "00000000-0000-0000-0000-000000000020";
      const MAIN_LEAGUE_IDS = new Set<string>([MAIN_LEAGUE_NBA_ID, MAIN_LEAGUE_WNBA_ID]);

      let targetLeagueId: string = MAIN_LEAGUE_NBA_ID;
      let code: "nba" | "wnba" = "nba";

      if (fantasy_league_id && typeof fantasy_league_id === "string" && !MAIN_LEAGUE_IDS.has(fantasy_league_id)) {
        // Look up the fantasy league
        const { data: fl, error: flErr } = await sb
          .from("leagues")
          .select("id, kind, status, sport, max_teams, owner_id")
          .eq("id", fantasy_league_id)
          .eq("kind", "fantasy")
          .maybeSingle();
        if (flErr) throw flErr;
        if (!fl) return errorResponse("VALIDATION", "Fantasy league not found");
        if (fl.status !== "draft" && fl.status !== "active") {
          return errorResponse("VALIDATION", "League is not accepting teams");
        }
        // Membership check (owner or league_member)
        if (fl.owner_id !== userId) {
          const { data: mem } = await sb
            .from("league_members")
            .select("id")
            .eq("league_id", fantasy_league_id)
            .eq("user_id", userId)
            .maybeSingle();
          if (!mem) return errorResponse("UNAUTHORIZED", "You must be a member of this league.");
        }
        // Capacity check
        const { count: teamCount } = await sb
          .from("teams")
          .select("id", { count: "exact", head: true })
          .eq("league_id", fantasy_league_id);
        if (typeof teamCount === "number" && teamCount >= (fl.max_teams ?? 20)) {
          return errorResponse("VALIDATION", "This league is full.");
        }
        targetLeagueId = fantasy_league_id;
        code = (fl.sport === "wnba" ? "wnba" : "nba");
      } else if (fantasy_league_id && typeof fantasy_league_id === "string" && MAIN_LEAGUE_IDS.has(fantasy_league_id)) {
        // Main league (NBA or WNBA) — free entry, no membership check.
        // Resolve sport from the league row itself (ignore caller-supplied league_code).
        const { data: fl } = await sb
          .from("leagues")
          .select("id, sport, max_teams")
          .eq("id", fantasy_league_id)
          .maybeSingle();
        const { count: teamCount } = await sb
          .from("teams")
          .select("id", { count: "exact", head: true })
          .eq("league_id", fantasy_league_id);
        if (typeof teamCount === "number" && teamCount >= (fl?.max_teams ?? 20)) {
          return errorResponse("VALIDATION", "This league is full.");
        }
        targetLeagueId = fantasy_league_id;
        code = (fl?.sport === "wnba" ? "wnba" : "nba");
      } else {
        // Backward compatible: Main League with optional NBA/WNBA selector
        const c = String(league_code ?? "nba").toLowerCase();
        if (c !== "nba" && c !== "wnba") {
          return errorResponse("VALIDATION", "league_code must be 'nba' or 'wnba'");
        }
        code = c as "nba" | "wnba";
        targetLeagueId = code === "wnba" ? MAIN_LEAGUE_WNBA_ID : MAIN_LEAGUE_NBA_ID;
      }

      const sportLeagueId = byCode[code];
      if (!sportLeagueId) return errorResponse("INTERNAL_ERROR", `Sport league '${code}' not configured`);

      const { data: team, error } = await sb
        .from("teams")
        .insert({
          name: name.trim(),
          description: description ?? null,
          owner_id: userId,
          league_id: targetLeagueId,
          sport_league_id: sportLeagueId,
        })
        .select()
        .single();
      if (error) throw error;
      return okResponse({ team: { ...team, league_code: code } });
    }

    if (req.method === "PATCH") {
      if (!userId) return errorResponse("UNAUTHORIZED", "Sign in required");
      if (!teamIdParam) return errorResponse("VALIDATION", "team_id query param required");
      // Verify ownership
      const { data: existing, error: exErr } = await sb
        .from("teams").select("owner_id").eq("id", teamIdParam).maybeSingle();
      if (exErr) throw exErr;
      if (!existing) return errorResponse("NOT_FOUND", "Team not found");
      if (existing.owner_id !== userId) {
        return errorResponse("FORBIDDEN", "You do not own this team");
      }
      const body = await req.json();
      if (body.league_code !== undefined) {
        return errorResponse("VALIDATION", "league cannot be changed after team creation");
      }
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) updates.name = body.name;
      if (body.description !== undefined) updates.description = body.description;
      const { data: team, error } = await sb
        .from("teams")
        .update(updates)
        .eq("id", teamIdParam)
        .select()
        .single();
      if (error) throw error;
      const byCode = await leaguesByCode(sb);
      return okResponse({ team: { ...team, league_code: codeForLeagueId(byCode, (team as any).sport_league_id) } });
    }

    if (req.method === "DELETE") {
      if (!userId) return errorResponse("UNAUTHORIZED", "Sign in required");
      if (!teamIdParam) return errorResponse("VALIDATION", "team_id query param required");
      const { data: existing, error: exErr } = await sb
        .from("teams").select("owner_id").eq("id", teamIdParam).maybeSingle();
      if (exErr) throw exErr;
      if (!existing) return errorResponse("NOT_FOUND", "Team not found");
      if (existing.owner_id !== userId) {
        return errorResponse("FORBIDDEN", "You do not own this team");
      }
      const { error } = await sb.from("teams").delete().eq("id", teamIdParam);
      if (error) throw error;
      return okResponse({ deleted: true });
    }

    return errorResponse("METHOD_NOT_ALLOWED", `Method ${req.method} not supported`);
  } catch (e) {
    console.error("[teams] Error:", e);
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Unknown error");
  }
});
