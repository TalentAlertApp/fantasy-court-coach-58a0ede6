import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_STATS = ["pts", "reb", "ast", "stl", "blk", "to"] as const;
const STAT_ORDER: Record<string, number> = { pts: 1, reb: 2, ast: 3, stl: 4, blk: 5, to: 6 };

function genJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

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
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return errorResponse("UNAUTHORIZED", "Invalid token", null, 401);
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return errorResponse("BAD_REQUEST", "Invalid JSON body", null, 400);
    }

    const name = String(body.name ?? "").trim();
    if (name.length < 3 || name.length > 40) {
      return errorResponse("VALIDATION", "Name must be 3-40 characters", null, 400);
    }
    const description = body.description ? String(body.description).slice(0, 500) : null;
    const sport = String(body.sport ?? "");
    if (sport !== "nba" && sport !== "wnba") {
      return errorResponse("VALIDATION", "Sport must be 'nba' or 'wnba'", null, 400);
    }
    const visibility = String(body.visibility ?? "private");
    if (!["private", "invite_only", "public"].includes(visibility)) {
      return errorResponse("VALIDATION", "Invalid visibility", null, 400);
    }
    const transferCap = Math.max(1, Math.min(5, Number(body.transfer_cap ?? 2)));

    const scoring = body.scoring ?? {};
    const weights = scoring.weights ?? {};
    const captainMultiplier = Number(scoring.captain_multiplier ?? 2);
    if (!isFiniteNum(captainMultiplier) || captainMultiplier < 1 || captainMultiplier > 3) {
      return errorResponse("VALIDATION", "Captain multiplier must be 1.0-3.0", null, 400);
    }
    for (const k of Object.keys(weights)) {
      if (!ALLOWED_STATS.includes(k as typeof ALLOWED_STATS[number])) {
        return errorResponse("VALIDATION", `Stat '${k}' is not allowed`, null, 400);
      }
      const v = Number(weights[k]);
      if (!isFiniteNum(v)) {
        return errorResponse("VALIDATION", `Weight for '${k}' must be a number`, null, 400);
      }
      if (k === "to") {
        if (v < -5 || v > 0) return errorResponse("VALIDATION", "TO weight must be between -5 and 0", null, 400);
      } else {
        if (v < 0 || v > 10) return errorResponse("VALIDATION", `${k} weight must be 0-10`, null, 400);
      }
    }

    const roster = body.roster ?? {};
    const benchCount = Math.max(3, Math.min(8, Number(roster.bench_count ?? 5)));
    const startersCount = 5;
    const totalPlayers = startersCount + benchCount;
    const budgetCap = roster.budget_cap == null ? null : Number(roster.budget_cap);
    const maxPerTeam = roster.max_players_per_team == null ? null : Math.max(1, Math.min(5, Number(roster.max_players_per_team)));

    const deadlineType = String(body.deadline_type ?? "first_game_of_day");
    if (!["first_game_of_day", "per_player_game_lock"].includes(deadlineType)) {
      return errorResponse("VALIDATION", "Invalid deadline_type", null, 400);
    }

    const chips = body.chips ?? {};
    const chipCaptainMultiplier = Number(chips.captain_multiplier ?? captainMultiplier);
    const wildcardCount = [1, 2].includes(Number(chips.wildcard_count)) ? Number(chips.wildcard_count) : 1;
    const allStarCount = [1, 2].includes(Number(chips.all_star_count)) ? Number(chips.all_star_count) : 1;
    const allStarMultiplier = Number(chips.all_star_multiplier ?? 2);

    // Service-role client for writes
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Resolve sport_league_id
    const { data: sportLeague, error: slErr } = await sb
      .from("leagues")
      .select("id")
      .eq("code", sport)
      .eq("kind", "sport")
      .maybeSingle();
    if (slErr || !sportLeague) {
      return errorResponse("SPORT_NOT_FOUND", `Sport league '${sport}' not found`, slErr?.message ?? null, 400);
    }
    const sportLeagueId = sportLeague.id;

    // 2. Lookup template scoring system (informational; not strictly required)
    await sb.from("scoring_systems").select("id").eq("is_template", true).eq("sport", sport).maybeSingle();

    // 3. Insert new scoring system (clone)
    const { data: newSystem, error: ssErr } = await sb
      .from("scoring_systems")
      .insert({
        name: `${name} Scoring`,
        code: `custom_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        sport,
        is_active: true,
        is_template: false,
        owner_id: userId,
      })
      .select("id")
      .single();
    if (ssErr || !newSystem) {
      return errorResponse("INSERT_FAILED", "Failed to create scoring system", ssErr?.message ?? null, 500);
    }
    const scoringSystemId = newSystem.id;

    // 4. Insert scoring rules
    const ruleRows: Array<Record<string, unknown>> = [];
    for (const k of ALLOWED_STATS) {
      if (weights[k] == null) continue;
      const w = Number(weights[k]);
      if (k === "to" && w === 0) continue;
      ruleRows.push({
        scoring_system_id: scoringSystemId,
        stat_key: k,
        rule_type: "multiplier",
        weight: w,
        applies_to: "player",
        sort_order: STAT_ORDER[k] ?? 99,
        is_active: true,
      });
    }
    // Captain rule
    ruleRows.push({
      scoring_system_id: scoringSystemId,
      stat_key: "captain",
      rule_type: "multiplier",
      weight: captainMultiplier,
      applies_to: "captain",
      sort_order: 100,
      is_active: true,
    });
    const { error: rulesErr } = await sb.from("scoring_rules").insert(ruleRows);
    if (rulesErr) {
      return errorResponse("INSERT_FAILED", "Failed to create scoring rules", rulesErr.message, 500);
    }

    // 5. Roster rule set
    const { data: rrs, error: rrsErr } = await sb
      .from("roster_rule_sets")
      .insert({
        name: `${name} Roster`,
        owner_id: userId,
        is_template: false,
        starters_count: startersCount,
        bench_count: benchCount,
        total_players: totalPlayers,
        fc_slots: 5,
        bc_slots: 5,
        budget_cap: budgetCap,
        max_players_per_team: maxPerTeam,
      })
      .select("id")
      .single();
    if (rrsErr || !rrs) {
      return errorResponse("INSERT_FAILED", "Failed to create roster rules", rrsErr?.message ?? null, 500);
    }

    // 6. Deadline rule set
    const { data: drs, error: drsErr } = await sb
      .from("deadline_rule_sets")
      .insert({
        name: `${name} Deadline`,
        owner_id: userId,
        is_template: false,
        deadline_type: deadlineType,
        minutes_before_game: 0,
        timezone: "Europe/Lisbon",
      })
      .select("id")
      .single();
    if (drsErr || !drs) {
      return errorResponse("INSERT_FAILED", "Failed to create deadline rules", drsErr?.message ?? null, 500);
    }

    // 7. Chip rule set
    const { data: crs, error: crsErr } = await sb
      .from("chip_rule_sets")
      .insert({
        name: `${name} Chips`,
        owner_id: userId,
        is_template: false,
        captain_enabled: !!chips.captain_enabled,
        captain_multiplier: chipCaptainMultiplier,
        wildcard_enabled: !!chips.wildcard_enabled,
        wildcard_count: wildcardCount,
        all_star_enabled: !!chips.all_star_enabled,
        all_star_count: allStarCount,
        all_star_multiplier: allStarMultiplier,
        reset_period: "season",
      })
      .select("id")
      .single();
    if (crsErr || !crs) {
      return errorResponse("INSERT_FAILED", "Failed to create chip rules", crsErr?.message ?? null, 500);
    }

    // 8. Generate join code with retry
    let joinCode = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const candidate = genJoinCode();
      const { data: existing } = await sb.from("leagues").select("id").eq("join_code", candidate).maybeSingle();
      if (!existing) {
        joinCode = candidate;
        break;
      }
    }
    if (!joinCode) {
      return errorResponse("JOIN_CODE_COLLISION", "Could not generate unique join code", null, 500);
    }

    // 9. Insert league
    const leagueCode = `fantasy_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const { data: league, error: lErr } = await sb
      .from("leagues")
      .insert({
        name,
        code: leagueCode,
        kind: "fantasy",
        sport,
        sport_league_id: sportLeagueId,
        owner_id: userId,
        description,
        visibility,
        status: "draft",
        transfer_cap: transferCap,
        join_code: joinCode,
        scoring_system_id: scoringSystemId,
        roster_rule_set_id: rrs.id,
        deadline_rule_set_id: drs.id,
        chip_rule_set_id: crs.id,
        is_active: true,
      })
      .select("id")
      .single();
    if (lErr || !league) {
      return errorResponse("INSERT_FAILED", "Failed to create league", lErr?.message ?? null, 500);
    }

    // 10. League members - owner
    const { error: lmErr } = await sb.from("league_members").insert({
      league_id: league.id,
      user_id: userId,
      role: "owner",
    });
    if (lmErr) {
      return errorResponse("INSERT_FAILED", "Failed to add owner as member", lmErr.message, 500);
    }

    return okResponse({ league_id: league.id, join_code: joinCode });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, error: { code: "INTERNAL", message: msg } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});