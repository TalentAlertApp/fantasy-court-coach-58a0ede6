import { handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveTeam } from "../_shared/resolve-team.ts";
import { round1 } from "../_shared/money.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { team_id, team_name } = await resolveTeam(req, sb);

    // Resolve the team's sport league once; used to scope roster rows
    // defensively so a stale cross-league roster row never leaks through.
    const { data: teamRow } = await sb
      .from("teams").select("sport_league_id").eq("id", team_id).maybeSingle();
    const teamLeagueId = teamRow?.sport_league_id ?? null;

    // Single retry for transient upstream 502s
    let rows: any[] | null = null;
    let lastErr: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      let q = sb.from("roster").select("*").eq("team_id", team_id);
      if (teamLeagueId) q = q.eq("league_id", teamLeagueId);
      const { data, error } = await q;
      if (!error) { rows = data ?? []; lastErr = null; break; }
      lastErr = error;
      await new Promise((r) => setTimeout(r, 250));
    }
    if (lastErr) throw lastErr;
    rows = rows ?? [];

    const starters = rows
      .filter((r: any) => r.slot === "STARTER")
      .map((r: any) => r.player_id);
    const bench = rows
      .filter((r: any) => r.slot === "BENCH")
      .map((r: any) => r.player_id);
    const captainRow = rows.find((r: any) => r.is_captain);

    // Pad arrays to length 5
    while (starters.length < 5) starters.push(0);
    while (bench.length < 5) bench.push(0);

    // Get team settings if any
    const { data: settings } = await sb
      .from("team_settings")
      .select("*")
      .eq("team_id", team_id)
      .maybeSingle();

    const gw = rows.length > 0 ? rows[0].gw : 1;
    const day = rows.length > 0 ? rows[0].day : 1;

    // Cap accounting uses each player's acquired_salary (the value at the
    // moment they joined this roster — immutable for the life of the row).
    // We also surface the current market total as informational.
    const playerIds = [...starters, ...bench].filter((id: number) => id > 0);
    const lockedTotal = round1(
      rows.reduce((s: number, r: any) => s + Number(r.acquired_salary ?? 0), 0),
    );
    let marketTotal = 0;
    if (playerIds.length > 0) {
      const { data: players } = await sb
        .from("players")
        .select("id, salary")
        .in("id", playerIds);
      if (players) {
        marketTotal = round1(
          players.reduce((sum: number, p: any) => sum + (p.salary || 0), 0),
        );
      }
    }

    const salaryCap = settings?.salary_cap ?? 100;

    // Free transfers = cap - SWAP/ADD transactions already logged this GW.
    // Source of truth: the `transactions` table (written by both
    // transactions-commit and roster-save).
    let transferCap = 2;
    if (teamLeagueId) {
      // teamLeagueId here is sport_league_id; transfer_cap lives on the
      // fantasy league row attached to the team.
      const { data: teamRow2 } = await sb
        .from("teams").select("league_id").eq("id", team_id).maybeSingle();
      const fantasyLeagueId = teamRow2?.league_id ?? null;
      if (fantasyLeagueId) {
        const { data: lg } = await sb
          .from("leagues").select("transfer_cap").eq("id", fantasyLeagueId).maybeSingle();
        if (lg?.transfer_cap != null) transferCap = Number(lg.transfer_cap);
      }
    }
    const { count: usedThisGw } = await sb
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team_id)
      .like("notes", `gw=${gw}%`);
    const freeTransfers = Math.max(0, transferCap - (usedThisGw ?? 0));

    return okResponse({
      roster: {
        gw,
        day,
        deadline_utc: null,
        starters: starters.slice(0, 5),
        bench: bench.slice(0, 5),
        captain_id: captainRow?.player_id ?? 0,
        bank_remaining: round1(salaryCap - lockedTotal),
        locked_total: round1(lockedTotal),
        market_total: round1(marketTotal),
        free_transfers_remaining: freeTransfers,
        transfer_cap: transferCap,
        constraints: {
          salary_cap: salaryCap,
          starters_count: 5,
          bench_count: 5,
          starter_fc_min: settings?.starter_fc_min ?? 2,
          starter_bc_min: settings?.starter_bc_min ?? 2,
        },
        updated_at: rows.length > 0 ? rows[0].updated_at : null,
        team_id,
        team_name,
      },
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message :
      typeof e === "string" ? e :
      (e && typeof e === "object" && "message" in (e as any))
        ? String((e as any).message)
        : JSON.stringify(e);
    console.error("[roster-current] Error:", msg, e);
    return errorResponse("ROSTER_ERROR", msg || "Unknown", null, 500);
  }
});
