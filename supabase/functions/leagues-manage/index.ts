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

async function authenticate(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return errorResponse("UNAUTHORIZED", "Missing bearer token", null, 401);
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user?.id) {
    return errorResponse("UNAUTHORIZED", "Invalid token", null, 401);
  }
  return { userId: data.user.id };
}

async function loadOwnedLeague(sb: any, leagueId: string, userId: string) {
  const { data: league, error } = await sb
    .from("leagues")
    .select("id, name, owner_id, status, kind, scoring_system_id, roster_rule_set_id, deadline_rule_set_id, chip_rule_set_id, join_code")
    .eq("id", leagueId)
    .maybeSingle();
  if (error || !league) return { error: errorResponse("NOT_FOUND", "League not found", error?.message ?? null, 404) };
  if (league.kind !== "fantasy") return { error: errorResponse("NOT_FANTASY", "Only fantasy leagues are managed here", null, 400) };
  if (league.owner_id !== userId) return { error: errorResponse("FORBIDDEN", "Only the commissioner can manage this league", null, 403) };
  return { league };
}

function jsonError(status: number, code: string, message: string, details: string | null = null) {
  return errorResponse(code, message, details, status);
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const url = new URL(req.url);
    // Path is like /leagues-manage or /leagues-manage/activate
    const segments = url.pathname.split("/").filter(Boolean);
    // Drop leading 'leagues-manage' if present
    const idx = segments.indexOf("leagues-manage");
    const action = idx >= 0 ? (segments[idx + 1] ?? "") : (segments[segments.length - 1] === "leagues-manage" ? "" : segments[segments.length - 1] ?? "");

    const auth = await authenticate(req);
    if (auth instanceof Response) return auth;
    const userId = auth.userId;

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ─────────────────────── MEMBERS ENDPOINTS ───────────────────────
    if (action === "members") {
      if (req.method === "GET") {
        const leagueId = url.searchParams.get("league_id");
        if (!leagueId) return jsonError(400, "BAD_REQUEST", "league_id is required");
        const owned = await loadOwnedLeague(sb, leagueId, userId);
        if ("error" in owned) return owned.error;

        const { data: members, error: mErr } = await sb
          .from("league_members")
          .select("user_id, role, joined_at")
          .eq("league_id", leagueId)
          .order("joined_at", { ascending: true });
        if (mErr) return jsonError(500, "QUERY_FAILED", "Failed to load members", mErr.message);

        const userIds = (members ?? []).map((m: any) => m.user_id);
        const teamCounts = new Map<string, number>();
        if (userIds.length) {
          const { data: teams } = await sb
            .from("teams")
            .select("owner_id")
            .eq("league_id", leagueId)
            .in("owner_id", userIds);
          for (const t of teams ?? []) {
            teamCounts.set(t.owner_id, (teamCounts.get(t.owner_id) ?? 0) + 1);
          }
        }

        // Resolve display labels via auth admin
        const labels = new Map<string, string>();
        for (const uid of userIds) {
          try {
            const { data: u } = await sb.auth.admin.getUserById(uid);
            const email = u?.user?.email ?? "";
            labels.set(uid, email ? email.split("@")[0] : uid.slice(0, 8));
          } catch {
            labels.set(uid, uid.slice(0, 8));
          }
        }

        return okResponse(
          (members ?? []).map((m: any) => ({
            user_id: m.user_id,
            role: m.role,
            joined_at: m.joined_at,
            team_count: teamCounts.get(m.user_id) ?? 0,
            owner_label: labels.get(m.user_id) ?? m.user_id.slice(0, 8),
          })),
        );
      }

      if (req.method === "PATCH") {
        const body = await req.json().catch(() => null);
        const leagueId = String(body?.league_id ?? "");
        const targetUserId = String(body?.user_id ?? "");
        const role = String(body?.role ?? "");
        if (!leagueId || !targetUserId || !["member", "commissioner", "owner"].includes(role)) {
          return jsonError(400, "BAD_REQUEST", "league_id, user_id, and valid role required");
        }
        const owned = await loadOwnedLeague(sb, leagueId, userId);
        if ("error" in owned) return owned.error;
        if (targetUserId === owned.league.owner_id) {
          return jsonError(400, "CANNOT_CHANGE_OWNER", "The league owner's role cannot be changed");
        }
        if (role === "owner") {
          return jsonError(400, "INVALID_ROLE", "Cannot promote to owner via this endpoint");
        }
        const { error } = await sb
          .from("league_members")
          .update({ role })
          .eq("league_id", leagueId)
          .eq("user_id", targetUserId);
        if (error) return jsonError(500, "UPDATE_FAILED", "Failed to update role", error.message);
        return okResponse({ ok: true });
      }

      if (req.method === "DELETE") {
        const body = await req.json().catch(() => null);
        const leagueId = String(body?.league_id ?? "");
        const targetUserId = String(body?.user_id ?? "");
        if (!leagueId || !targetUserId) return jsonError(400, "BAD_REQUEST", "league_id and user_id required");

        const owned = await loadOwnedLeague(sb, leagueId, userId);
        if ("error" in owned) return owned.error;
        if (targetUserId === owned.league.owner_id) {
          return jsonError(400, "CANNOT_REMOVE_OWNER", "The league owner cannot be removed");
        }

        // Find target's teams in this league and clean up their dependent rows
        const { data: targetTeams } = await sb
          .from("teams")
          .select("id")
          .eq("league_id", leagueId)
          .eq("owner_id", targetUserId);
        const teamIds = (targetTeams ?? []).map((t: any) => t.id);
        if (teamIds.length) {
          await sb.from("roster").delete().in("team_id", teamIds);
          await sb.from("team_chips").delete().in("team_id", teamIds);
          await sb.from("team_settings").delete().in("team_id", teamIds);
          await sb.from("transactions").delete().in("team_id", teamIds);
          await sb.from("teams").delete().in("id", teamIds);
        }

        const { error: lmErr } = await sb
          .from("league_members")
          .delete()
          .eq("league_id", leagueId)
          .eq("user_id", targetUserId);
        if (lmErr) return jsonError(500, "DELETE_FAILED", "Failed to remove member", lmErr.message);
        return okResponse({ ok: true });
      }

      return jsonError(405, "METHOD_NOT_ALLOWED", "Unsupported method on /members");
    }

    // ─────────────────────── ACTIVATE / ARCHIVE / REGEN ───────────────────────
    if (action === "activate" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const leagueId = String(body?.league_id ?? "");
      if (!leagueId) return jsonError(400, "BAD_REQUEST", "league_id is required");
      const owned = await loadOwnedLeague(sb, leagueId, userId);
      if ("error" in owned) return owned.error;
      if (owned.league.status !== "draft") return jsonError(400, "INVALID_STATUS", "Only draft leagues can be activated");

      const { count, error: cErr } = await sb
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("league_id", leagueId);
      if (cErr) return jsonError(500, "QUERY_FAILED", "Failed to count teams", cErr.message);
      if ((count ?? 0) < 2) return jsonError(400, "TOO_FEW_TEAMS", "League must have at least 2 teams to activate");

      const { error } = await sb.from("leagues").update({ status: "active" }).eq("id", leagueId);
      if (error) return jsonError(500, "UPDATE_FAILED", "Failed to activate league", error.message);
      return okResponse({ ok: true });
    }

    if (action === "archive" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const leagueId = String(body?.league_id ?? "");
      if (!leagueId) return jsonError(400, "BAD_REQUEST", "league_id is required");
      const owned = await loadOwnedLeague(sb, leagueId, userId);
      if ("error" in owned) return owned.error;
      const { error } = await sb.from("leagues").update({ status: "archived" }).eq("id", leagueId);
      if (error) return jsonError(500, "UPDATE_FAILED", "Failed to archive league", error.message);
      return okResponse({ ok: true });
    }

    if (action === "regenerate-code" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const leagueId = String(body?.league_id ?? "");
      if (!leagueId) return jsonError(400, "BAD_REQUEST", "league_id is required");
      const owned = await loadOwnedLeague(sb, leagueId, userId);
      if ("error" in owned) return owned.error;
      let newCode = "";
      for (let i = 0; i < 5; i++) {
        const candidate = genJoinCode();
        const { data: existing } = await sb.from("leagues").select("id").eq("join_code", candidate).maybeSingle();
        if (!existing) { newCode = candidate; break; }
      }
      if (!newCode) return jsonError(500, "JOIN_CODE_COLLISION", "Could not generate unique join code");
      const { error } = await sb.from("leagues").update({ join_code: newCode }).eq("id", leagueId);
      if (error) return jsonError(500, "UPDATE_FAILED", "Failed to update join code", error.message);
      return okResponse({ join_code: newCode });
    }

    // ─────────────────────── DELETE LEAGUE ───────────────────────
    if (req.method === "DELETE") {
      const body = await req.json().catch(() => ({}));
      const leagueId = String(body?.league_id ?? "");
      if (!leagueId) return jsonError(400, "BAD_REQUEST", "league_id is required");
      const owned = await loadOwnedLeague(sb, leagueId, userId);
      if ("error" in owned) return owned.error;
      if (owned.league.status !== "draft") return jsonError(400, "INVALID_STATUS", "Only draft leagues can be deleted");

      const { count: teamCount } = await sb
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("league_id", leagueId);
      if ((teamCount ?? 0) > 0) return jsonError(400, "HAS_TEAMS", "Remove all teams before deleting the league");

      // Delete cascade: members → league → cloned rule sets + scoring system (+ rules)
      await sb.from("league_members").delete().eq("league_id", leagueId);
      const { error: lDelErr } = await sb.from("leagues").delete().eq("id", leagueId);
      if (lDelErr) return jsonError(500, "DELETE_FAILED", "Failed to delete league", lDelErr.message);

      // Delete cloned (non-template, owned) rule sets
      const ssId = owned.league.scoring_system_id as string | null;
      if (ssId) {
        await sb.from("scoring_rules").delete().eq("scoring_system_id", ssId);
        await sb.from("scoring_systems").delete().eq("id", ssId).eq("is_template", false).eq("owner_id", userId);
      }
      const cleanupSet = async (table: string, id: string | null) => {
        if (!id) return;
        await sb.from(table).delete().eq("id", id).eq("is_template", false).eq("owner_id", userId);
      };
      await cleanupSet("roster_rule_sets", owned.league.roster_rule_set_id);
      await cleanupSet("deadline_rule_sets", owned.league.deadline_rule_set_id);
      await cleanupSet("chip_rule_sets", owned.league.chip_rule_set_id);

      return okResponse({ ok: true });
    }

    // ─────────────────────── PATCH LEAGUE SETTINGS ───────────────────────
    if (req.method === "PATCH") {
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") return jsonError(400, "BAD_REQUEST", "Invalid JSON body");
      const leagueId = String(body.league_id ?? "");
      if (!leagueId) return jsonError(400, "BAD_REQUEST", "league_id is required");

      const owned = await loadOwnedLeague(sb, leagueId, userId);
      if ("error" in owned) return owned.error;
      const league = owned.league;
      const isDraft = league.status === "draft";

      const leagueUpdate: Record<string, unknown> = {};
      if (typeof body.name === "string") {
        const n = body.name.trim();
        if (n.length < 3 || n.length > 40) return jsonError(400, "VALIDATION", "Name must be 3-40 characters");
        leagueUpdate.name = n;
      }
      if (body.description !== undefined) {
        leagueUpdate.description = body.description ? String(body.description).slice(0, 500) : null;
      }
      if (body.visibility !== undefined) {
        if (!["private", "invite_only", "public"].includes(String(body.visibility))) {
          return jsonError(400, "VALIDATION", "Invalid visibility");
        }
        leagueUpdate.visibility = body.visibility;
      }
      if (body.transfer_cap !== undefined && isDraft) {
        leagueUpdate.transfer_cap = Math.max(1, Math.min(5, Number(body.transfer_cap)));
      }

      if (Object.keys(leagueUpdate).length) {
        const { error } = await sb.from("leagues").update(leagueUpdate).eq("id", leagueId);
        if (error) return jsonError(500, "UPDATE_FAILED", "Failed to update league", error.message);
      }

      // Rule edits only in draft
      if (!isDraft) {
        if (body.scoring || body.roster || body.deadline_type || body.chips) {
          return jsonError(400, "LOCKED", "Rule sets are locked once the league is active");
        }
        return okResponse({ ok: true });
      }

      // Scoring rules update
      if (body.scoring) {
        const weights = body.scoring.weights ?? {};
        const captainMultiplier = Number(body.scoring.captain_multiplier ?? 2);
        if (!isFiniteNum(captainMultiplier) || captainMultiplier < 1 || captainMultiplier > 3) {
          return jsonError(400, "VALIDATION", "Captain multiplier must be 1.0-3.0");
        }
        for (const k of Object.keys(weights)) {
          if (!ALLOWED_STATS.includes(k as typeof ALLOWED_STATS[number])) {
            return jsonError(400, "VALIDATION", `Stat '${k}' is not allowed`);
          }
          const v = Number(weights[k]);
          if (!isFiniteNum(v)) return jsonError(400, "VALIDATION", `Weight for '${k}' must be a number`);
          if (k === "to") { if (v < -5 || v > 0) return jsonError(400, "VALIDATION", "TO weight must be -5 to 0"); }
          else { if (v < 0 || v > 10) return jsonError(400, "VALIDATION", `${k} weight must be 0-10`); }
        }
        // Replace rules on this league's scoring system
        const ssId = league.scoring_system_id;
        if (!ssId) return jsonError(500, "NO_SYSTEM", "League has no scoring system");
        await sb.from("scoring_rules").delete().eq("scoring_system_id", ssId);
        const ruleRows: Array<Record<string, unknown>> = [];
        for (const k of ALLOWED_STATS) {
          if (weights[k] == null) continue;
          const w = Number(weights[k]);
          if (k === "to" && w === 0) continue;
          ruleRows.push({
            scoring_system_id: ssId,
            stat_key: k,
            rule_type: "multiplier",
            weight: w,
            applies_to: "player",
            sort_order: STAT_ORDER[k] ?? 99,
            is_active: true,
          });
        }
        ruleRows.push({
          scoring_system_id: ssId,
          stat_key: "captain",
          rule_type: "multiplier",
          weight: captainMultiplier,
          applies_to: "captain",
          sort_order: 100,
          is_active: true,
        });
        if (ruleRows.length) {
          const { error } = await sb.from("scoring_rules").insert(ruleRows);
          if (error) return jsonError(500, "UPDATE_FAILED", "Failed to update scoring rules", error.message);
        }
      }

      if (body.roster) {
        const rrsId = league.roster_rule_set_id;
        if (!rrsId) return jsonError(500, "NO_RRS", "League has no roster rule set");
        const benchCount = Math.max(3, Math.min(8, Number(body.roster.bench_count ?? 5)));
        const update: Record<string, unknown> = {
          bench_count: benchCount,
          total_players: 5 + benchCount,
          budget_cap: body.roster.budget_cap == null ? null : Number(body.roster.budget_cap),
          max_players_per_team: body.roster.max_players_per_team == null ? null : Math.max(1, Math.min(5, Number(body.roster.max_players_per_team))),
        };
        const { error } = await sb.from("roster_rule_sets").update(update).eq("id", rrsId);
        if (error) return jsonError(500, "UPDATE_FAILED", "Failed to update roster rules", error.message);
      }

      if (body.deadline_type) {
        if (!["first_game_of_day", "per_player_game_lock"].includes(body.deadline_type)) {
          return jsonError(400, "VALIDATION", "Invalid deadline_type");
        }
        const drsId = league.deadline_rule_set_id;
        if (!drsId) return jsonError(500, "NO_DRS", "League has no deadline rule set");
        const { error } = await sb.from("deadline_rule_sets").update({ deadline_type: body.deadline_type }).eq("id", drsId);
        if (error) return jsonError(500, "UPDATE_FAILED", "Failed to update deadline rules", error.message);
      }

      if (body.chips) {
        const crsId = league.chip_rule_set_id;
        if (!crsId) return jsonError(500, "NO_CRS", "League has no chip rule set");
        const c = body.chips;
        const update: Record<string, unknown> = {
          captain_enabled: !!c.captain_enabled,
          captain_multiplier: Number(c.captain_multiplier ?? 2),
          wildcard_enabled: !!c.wildcard_enabled,
          wildcard_count: [1, 2].includes(Number(c.wildcard_count)) ? Number(c.wildcard_count) : 1,
          all_star_enabled: !!c.all_star_enabled,
          all_star_count: [1, 2].includes(Number(c.all_star_count)) ? Number(c.all_star_count) : 1,
          all_star_multiplier: Number(c.all_star_multiplier ?? 2),
        };
        const { error } = await sb.from("chip_rule_sets").update(update).eq("id", crsId);
        if (error) return jsonError(500, "UPDATE_FAILED", "Failed to update chip rules", error.message);
      }

      return okResponse({ ok: true });
    }

    // ─────────────────────── LEAVE (non-owner self-removal) ───────────────────────
    if (action === "leave" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const leagueId = String(body?.league_id ?? "");
      if (!leagueId) return jsonError(400, "BAD_REQUEST", "league_id is required");
      const { data: league } = await sb.from("leagues").select("id, owner_id").eq("id", leagueId).maybeSingle();
      if (!league) return jsonError(404, "NOT_FOUND", "League not found");
      if (league.owner_id === userId) return jsonError(400, "OWNER_CANNOT_LEAVE", "Commissioner cannot leave their own league");

      const { data: myTeams } = await sb.from("teams").select("id").eq("league_id", leagueId).eq("owner_id", userId);
      const teamIds = (myTeams ?? []).map((t: any) => t.id);
      if (teamIds.length) {
        await sb.from("roster").delete().in("team_id", teamIds);
        await sb.from("team_chips").delete().in("team_id", teamIds);
        await sb.from("team_settings").delete().in("team_id", teamIds);
        await sb.from("transactions").delete().in("team_id", teamIds);
        await sb.from("teams").delete().in("id", teamIds);
      }
      await sb.from("league_members").delete().eq("league_id", leagueId).eq("user_id", userId);
      return okResponse({ ok: true });
    }

    // ─────────────────────── ATTACH EXISTING TEAM TO LEAGUE (clone) ───────────────────────
    if (action === "attach-team" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const targetLeagueId = String(body?.league_id ?? "");
      const sourceTeamId = String(body?.team_id ?? "");
      if (!targetLeagueId || !sourceTeamId) {
        return jsonError(400, "BAD_REQUEST", "league_id and team_id are required");
      }

      // Source team must be owned by caller
      const { data: srcTeam, error: stErr } = await sb
        .from("teams")
        .select("id, name, description, owner_id, league_id, sport_league_id")
        .eq("id", sourceTeamId)
        .maybeSingle();
      if (stErr || !srcTeam) return jsonError(404, "NOT_FOUND", "Source team not found");
      if (srcTeam.owner_id !== userId) return jsonError(403, "FORBIDDEN", "You do not own this team");

      // Source league (for sport)
      const { data: srcLeague } = await sb
        .from("leagues")
        .select("id, sport")
        .eq("id", srcTeam.league_id)
        .maybeSingle();
      const srcSport = srcLeague?.sport ?? "nba";

      // Target league
      const { data: tgtLeague, error: tlErr } = await sb
        .from("leagues")
        .select("id, name, sport, kind, status, visibility, max_teams, sport_league_id")
        .eq("id", targetLeagueId)
        .maybeSingle();
      if (tlErr || !tgtLeague) return jsonError(404, "NOT_FOUND", "Target league not found");
      if (tgtLeague.kind !== "fantasy") return jsonError(400, "NOT_FANTASY", "Target must be a fantasy league");
      if (!["draft", "active"].includes(tgtLeague.status)) {
        return jsonError(400, "INVALID_STATUS", "League is not accepting new teams");
      }
      if (tgtLeague.sport !== srcSport) {
        return jsonError(400, "SPORT_MISMATCH", `Team is ${srcSport.toUpperCase()}, league is ${String(tgtLeague.sport).toUpperCase()}`);
      }

      // Capacity
      const { count: teamCount } = await sb
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("league_id", targetLeagueId);
      if ((teamCount ?? 0) >= (tgtLeague.max_teams ?? 20)) {
        return jsonError(403, "FULL", "This league is full");
      }

      // Already has a team in target?
      const { data: existingTeam } = await sb
        .from("teams")
        .select("id")
        .eq("league_id", targetLeagueId)
        .eq("owner_id", userId)
        .maybeSingle();
      if (existingTeam) return jsonError(409, "ALREADY_HAS_TEAM", "You already have a team in this league");

      // Name collision → suffix
      let cloneName = srcTeam.name;
      const { data: nameClash } = await sb
        .from("teams")
        .select("id")
        .eq("league_id", targetLeagueId)
        .eq("name", cloneName)
        .maybeSingle();
      if (nameClash) cloneName = `${srcTeam.name} (2)`.slice(0, 40);

      // Insert cloned team
      const { data: newTeam, error: insErr } = await sb
        .from("teams")
        .insert({
          name: cloneName,
          description: srcTeam.description ?? null,
          owner_id: userId,
          league_id: targetLeagueId,
          sport_league_id: tgtLeague.sport_league_id ?? srcTeam.sport_league_id ?? null,
        })
        .select("id, name")
        .single();
      if (insErr || !newTeam) return jsonError(500, "INSERT_FAILED", "Failed to create team", insErr?.message ?? null);

      // Copy roster (current entries from source team) into the new team
      const { data: srcRoster } = await sb
        .from("roster")
        .select("slot, player_id, is_captain, gw, day")
        .eq("team_id", sourceTeamId);
      if (srcRoster && srcRoster.length) {
        const rows = srcRoster.map((r: any) => ({
          team_id: newTeam.id,
          league_id: targetLeagueId,
          slot: r.slot,
          player_id: r.player_id,
          is_captain: r.is_captain,
          gw: r.gw,
          day: r.day,
        }));
        await sb.from("roster").insert(rows);
      }

      // Copy team_settings if present
      const { data: srcSettings } = await sb
        .from("team_settings")
        .select("salary_cap, starter_fc_min, starter_bc_min")
        .eq("team_id", sourceTeamId)
        .maybeSingle();
      if (srcSettings) {
        await sb.from("team_settings").insert({ team_id: newTeam.id, ...srcSettings });
      }

      // Ensure league membership row exists
      const { data: existingMember } = await sb
        .from("league_members")
        .select("id")
        .eq("league_id", targetLeagueId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existingMember) {
        await sb.from("league_members").insert({
          league_id: targetLeagueId,
          user_id: userId,
          role: "member",
        });
      }

      return okResponse({ team_id: newTeam.id, team_name: newTeam.name, league_id: targetLeagueId, league_name: tgtLeague.name });
    }

    return jsonError(404, "UNKNOWN_ACTION", `Unknown action: ${action || "(root)"} ${req.method}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ ok: false, error: { code: "INTERNAL", message: msg } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});