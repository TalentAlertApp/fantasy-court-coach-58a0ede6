import { handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveTeam } from "../_shared/resolve-team.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SALARY_CAP = 100;
const ROSTER_SIZE = 10;
const MAX_PER_PRO_TEAM = 2;

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function projFor(p: any) {
  return {
    fp5: num(p?.fp_pg5),
    stl5: num(p?.stl5),
    blk5: num(p?.blk5),
    ast5: num(p?.ast5 ?? p?.ast),
  };
}

/**
 * Sum salary + projection stats.
 * @param salaryKey  "salary" for current market value, or "acquired_salary"
 *                   for the locked roster-cap value.
 */
function aggregate(players: any[], salaryKey: "salary" | "acquired_salary" = "salary") {
  let salary = 0, fp5 = 0, stocks5 = 0, ast5 = 0;
  for (const p of players) {
    salary += num(p?.[salaryKey]);
    const pr = projFor(p);
    fp5 += pr.fp5;
    stocks5 += pr.stl5 + pr.blk5;
    ast5 += pr.ast5;
  }
  return { salary, fp5, stocks5, ast5 };
}

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { team_id } = await resolveTeam(req, sb);

    const body = await req.json().catch(() => ({}));
    // Accept either {adds, drops} (legacy/UI) or {ins, outs}.
    const ins: number[] = (Array.isArray(body?.ins) ? body.ins : Array.isArray(body?.adds) ? body.adds : [])
      .map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0);
    const outs: number[] = (Array.isArray(body?.outs) ? body.outs : Array.isArray(body?.drops) ? body.drops : [])
      .map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0);

    // Resolve team's league.
    const { data: teamRow } = await sb
      .from("teams").select("sport_league_id").eq("id", team_id).maybeSingle();
    const teamLeagueId: string | null = teamRow?.sport_league_id ?? null;
    if (!teamLeagueId) {
      return errorResponse("TEAM_LEAGUE_MISSING", "Team has no sport league assigned", null, 400);
    }

    // Reject cross-league requests up front so the UI never previews wrong-league data.
    const reqLeagueCode = String(body?.league_code ?? "").toLowerCase();
    if (reqLeagueCode === "nba" || reqLeagueCode === "wnba") {
      const { data: leagueRow } = await sb
        .from("leagues").select("id").eq("code", reqLeagueCode).maybeSingle();
      if (leagueRow?.id && leagueRow.id !== teamLeagueId) {
        return errorResponse(
          "LEAGUE_MISMATCH",
          `This team belongs to a different league than the request (${reqLeagueCode}).`,
          null,
          400,
        );
      }
    }

    // Load roster + linked player aggregates.
    const { data: rosterRows, error: rosterErr } = await sb
      .from("roster").select("player_id, slot, acquired_salary").eq("team_id", team_id);
    if (rosterErr) return errorResponse("ROSTER_LOAD_FAILED", rosterErr.message, null, 500);

    const rosterIds = (rosterRows ?? []).map((r: any) => Number(r.player_id));
    const acquiredById = new Map<number, number>();
    for (const r of (rosterRows ?? []) as any[]) {
      acquiredById.set(Number(r.player_id), Number(r.acquired_salary ?? 0));
    }
    const allIds = Array.from(new Set<number>([...rosterIds, ...ins]));

    let beforePlayers: any[] = [];
    let inPlayers: any[] = [];
    let staleRosterIds: number[] = [];
    if (allIds.length > 0) {
      const { data: pRows, error: pErr } = await sb
        .from("players")
        .select("id, name, team, fc_bc, salary, league_id, fp_pg5, stl5, blk5, ast5, ast")
        .in("id", allIds);
      if (pErr) return errorResponse("PLAYERS_LOAD_FAILED", pErr.message, null, 500);
      const byId = new Map<number, any>();
      for (const p of pRows ?? []) byId.set(Number((p as any).id), p);
      // Drop any roster row whose linked player belongs to another league.
      // These are stale rows and must NOT count toward salary/projection math.
      beforePlayers = rosterIds
        .map((id) => byId.get(id))
        .filter((p) => p && p.league_id === teamLeagueId)
        // Attach the locked acquisition salary onto each roster player so the
        // aggregate(..., "acquired_salary") path can read it.
        .map((p: any) => ({ ...p, acquired_salary: acquiredById.get(Number(p.id)) ?? 0 }));
      staleRosterIds = rosterIds.filter((id) => {
        const p = byId.get(id);
        return !p || p.league_id !== teamLeagueId;
      });
      inPlayers = ins.map((id) => byId.get(id)).filter(Boolean);
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    if (staleRosterIds.length > 0) {
      warnings.push(
        `Ignoring ${staleRosterIds.length} roster entr${staleRosterIds.length === 1 ? "y" : "ies"} from a different league`,
      );
    }

    // Validate ins exist and are same-league.
    for (const id of ins) {
      const p = inPlayers.find((x) => Number(x.id) === id);
      if (!p) { errors.push(`Incoming player ${id} not found`); continue; }
      if (teamLeagueId && p.league_id !== teamLeagueId) {
        errors.push(`Player ${id} (${p.name}) belongs to a different league`);
      }
    }
    // Validate outs are on roster.
    for (const id of outs) {
      if (!rosterIds.includes(id)) errors.push(`Outgoing player ${id} is not on roster`);
    }

    // Cap accounting uses locked (acquired) salaries for the existing roster.
    // IN players enter at their current market value (becomes their lock).
    const before = aggregate(beforePlayers, "acquired_salary");
    const beforeMarket = aggregate(beforePlayers, "salary");
    const outPlayers = outs
      .map((id) => beforePlayers.find((p) => Number(p.id) === id))
      .filter(Boolean);
    const removedLocked = aggregate(outPlayers, "acquired_salary");
    const removedMarket = aggregate(outPlayers, "salary");
    const added = aggregate(inPlayers, "salary");

    const after = {
      // Cap usage after the trade = kept (locked) + new IN (current).
      salary: before.salary - removedLocked.salary + added.salary,
      fp5: before.fp5 - removedLocked.fp5 + added.fp5,
      stocks5: before.stocks5 - removedLocked.stocks5 + added.stocks5,
      ast5: before.ast5 - removedLocked.ast5 + added.ast5,
    };

    // Compose post-trade roster for shape validation.
    const postIds = new Set<number>(rosterIds);
    for (const id of outs) postIds.delete(id);
    for (const id of ins) postIds.add(id);
    const postPlayers = beforePlayers
      .filter((p) => postIds.has(Number(p.id)) && !ins.includes(Number(p.id)))
      .concat(inPlayers.filter((p) => postIds.has(Number(p.id))));

    // Trade-budget check: IN cost (current market) must not exceed the
    // current bank plus the market value of OUT players being released.
    // This matches the rule: "selling a player frees their CURRENT salary
    // as cap space; the locked acquisition salary still counts for cap on
    // anyone you keep."
    const tradeBudget = (SALARY_CAP - before.salary) + removedMarket.salary;
    if (added.salary > tradeBudget + 1e-6) {
      const over = added.salary - tradeBudget;
      errors.push(`Over budget by $${over.toFixed(1)}M (IN $${added.salary.toFixed(1)}M > $${tradeBudget.toFixed(1)}M available)`);
    }

    // Roster size.
    if (postPlayers.length > ROSTER_SIZE) {
      errors.push(`Roster size would be ${postPlayers.length} (max ${ROSTER_SIZE})`);
    }

    // FC/BC balance — enforce 5/5 only when full roster.
    let fc = 0, bc = 0;
    for (const p of postPlayers) {
      if (p.fc_bc === "FC") fc++;
      else if (p.fc_bc === "BC") bc++;
    }
    if (postPlayers.length === ROSTER_SIZE && (fc !== 5 || bc !== 5)) {
      errors.push(`FC/BC balance broken: ${fc} FC / ${bc} BC (must be 5/5)`);
    } else if (fc > 5 || bc > 5) {
      errors.push(`FC/BC limit exceeded: ${fc} FC / ${bc} BC`);
    }

    // Max per pro team.
    const teamCounts: Record<string, number> = {};
    for (const p of postPlayers) {
      const tri = String(p.team ?? "").toUpperCase();
      if (!tri) continue;
      teamCounts[tri] = (teamCounts[tri] ?? 0) + 1;
      if (teamCounts[tri] > MAX_PER_PRO_TEAM) {
        errors.push(`Max ${MAX_PER_PRO_TEAM} per pro team violated: ${teamCounts[tri]} from ${tri}`);
      }
    }

    // Soft warnings.
    if (after.fp5 === 0 && before.fp5 === 0) {
      warnings.push("Pre-season: projections unavailable until game data is imported");
    }

    // "Available to spend on the IN side" — tells the picker how much cap
    // relief the user actually unlocks by releasing the chosen OUTs.
    const availableToSpend = (SALARY_CAP - before.salary) + removedMarket.salary;

    return okResponse({
      is_valid: errors.length === 0,
      errors,
      warnings,
      before: {
        salary_used: round1(before.salary),
        bank_remaining: round1(SALARY_CAP - before.salary),
        proj_fp5: round1(before.fp5),
        proj_stocks5: round1(before.stocks5),
      },
      after: {
        salary_used: round1(after.salary),
        bank_remaining: round1(SALARY_CAP - after.salary),
        proj_fp5: round1(after.fp5),
        proj_stocks5: round1(after.stocks5),
      },
      delta: {
        proj_fp5: round1(after.fp5 - before.fp5),
        proj_stocks5: round1(after.stocks5 - before.stocks5),
        proj_ast5: round1(after.ast5 - before.ast5),
      },
      market: {
        before_total: round1(beforeMarket.salary),
        freed: round1(removedMarket.salary),
        cost: round1(added.salary),
        available_to_spend: round1(availableToSpend),
      },
    });
  } catch (e) {
    return errorResponse("SIM_ERROR", e instanceof Error ? e.message : "Unknown", null, 500);
  }
});
