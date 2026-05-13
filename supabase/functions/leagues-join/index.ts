import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  if (req.method !== "POST") {
    return errorResponse("METHOD_NOT_ALLOWED", "Use POST", null, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("UNAUTHORIZED", "Missing bearer token", null, 401);
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return errorResponse("UNAUTHORIZED", "Invalid token", null, 401);
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => null);
    const rawCode = String(body?.join_code ?? "").trim().toUpperCase();
    if (!rawCode) return errorResponse("BAD_REQUEST", "join_code is required", null, 400);

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Look up league by join code
    const { data: league, error: lErr } = await sb
      .from("leagues")
      .select("id, name, sport, kind, status, visibility, max_teams, join_code")
      .eq("kind", "fantasy")
      .eq("join_code", rawCode)
      .in("status", ["draft", "active"])
      .maybeSingle();
    if (lErr) return errorResponse("QUERY_FAILED", "Lookup failed", lErr.message, 500);
    if (!league) return errorResponse("INVALID_CODE", "Invalid or expired invite code", null, 404);

    // 2. Visibility check
    if (league.visibility === "private") {
      return errorResponse("PRIVATE", "This league is private.", null, 403);
    }

    // 3. Capacity check (count teams in league)
    const { count: teamCount, error: cErr } = await sb
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("league_id", league.id);
    if (cErr) return errorResponse("QUERY_FAILED", "Count failed", cErr.message, 500);
    if ((teamCount ?? 0) >= (league.max_teams ?? 20)) {
      return errorResponse("FULL", "This league is full.", null, 403);
    }

    // 4. Already member?
    const { data: existing } = await sb
      .from("league_members")
      .select("id")
      .eq("league_id", league.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      return errorResponse(
        "ALREADY_MEMBER",
        "You are already a member of this league.",
        null,
        409,
      );
    }

    // 5. Insert membership
    const { error: insErr } = await sb.from("league_members").insert({
      league_id: league.id,
      user_id: userId,
      role: "member",
    });
    if (insErr) return errorResponse("INSERT_FAILED", "Failed to join league", insErr.message, 500);

    return okResponse({
      league_id: league.id,
      league_name: league.name,
      sport: league.sport,
      join_code: league.join_code,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, error: { code: "INTERNAL", message: msg } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});