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

function aggregate(players: any[]) {
  let salary = 0, fp5 = 0, stocks5 = 0, ast5 = 0;
  for (const p of players) {
    salary += num(p?.salary);
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

    // Load roster + linked player aggregates.
    const { data: rosterRows, error: rosterErr } = await sb
      .from("roster").select("player_id, slot").eq("team_id", team_id);
    if (rosterErr) return errorResponse("ROSTER_LOAD_FAILED", rosterErr.message, null, 500);

    const rosterIds = (rosterRows ?? []).map((r: any) => Number(r.player_id));
    const allIds = Array.from(new Set<number>([...rosterIds, ...ins]));

    let beforePlayers: any[] = [];
    let inPlayers: any[] = [];
    if (allIds.length > 0) {
      const { data: pRows, error: pErr } = await sb
        .from("players")
        .select("id, name, team, fc_bc, salary, league_id, fp_pg5, stl5, blk5, ast5, ast")
        .in("id", allIds);
      if (pErr) return errorResponse("PLAYERS_LOAD_FAILED", pErr.message, null, 500);
      const byId = new Map<number, any>();
      for (const p of pRows ?? []) byId.set(Number((p as any).id), p);
      beforePlayers = rosterIds.map((id) => byId.get(id)).filter(Boolean);
      inPlayers = ins.map((id) => byId.get(id)).filter(Boolean);
    }

    const errors: string[] = [];
    const warnings: string[] = [];

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

    const before = aggregate(beforePlayers);
    const outPlayers = outs
      .map((id) => beforePlayers.find((p) => Number(p.id) === id))
      .filter(Boolean);
    const removed = aggregate(outPlayers);
    const added = aggregate(inPlayers);

    const after = {
      salary: before.salary - removed.salary + added.salary,
      fp5: before.fp5 - removed.fp5 + added.fp5,
      stocks5: before.stocks5 - removed.stocks5 + added.stocks5,
      ast5: before.ast5 - removed.ast5 + added.ast5,
    };

    // Compose post-trade roster for shape validation.
    const postIds = new Set<number>(rosterIds);
    for (const id of outs) postIds.delete(id);
    for (const id of ins) postIds.add(id);
    const postPlayers = beforePlayers
      .filter((p) => postIds.has(Number(p.id)) && !ins.includes(Number(p.id)))
      .concat(inPlayers.filter((p) => postIds.has(Number(p.id))));

    // Salary cap.
    if (after.salary > SALARY_CAP + 1e-6) {
      errors.push(`Salary cap exceeded: $${after.salary.toFixed(1)}M > $${SALARY_CAP}M`);
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
    });
  } catch (e) {
    return errorResponse("SIM_ERROR", e instanceof Error ? e.message : "Unknown", null, 500);
  }
});
