import { handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveTeam } from "../_shared/resolve-team.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { team_id, team_name } = await resolveTeam(req, sb);

    // Resolve team's sport league
    const { data: teamRow } = await sb
      .from("teams").select("sport_league_id").eq("id", team_id).maybeSingle();
    const teamLeagueId = teamRow?.sport_league_id;
    if (!teamLeagueId) return errorResponse("TEAM_LEAGUE_MISSING", "Team has no sport league assigned", null, 400);

    // Parse body { gw, day, strategy }
    let body: any = {};
    try { body = await req.json(); } catch { /* noop */ }
    // Cross-league guard: caller's league_code must match the team's league.
    const reqLeagueCode = String(body?.league_code ?? "").toLowerCase();
    if (reqLeagueCode === "nba" || reqLeagueCode === "wnba") {
      const { data: leagueRow } = await sb
        .from("leagues").select("id").eq("code", reqLeagueCode).maybeSingle();
      if (leagueRow?.id && leagueRow.id !== teamLeagueId) {
        return errorResponse("LEAGUE_MISMATCH",
          `This team belongs to a different league than the request (${reqLeagueCode}).`, null, 400);
      }
    }
    const gw = Number(body.gw) || 1;
    const day = Number(body.day) || 1;
    const strategy: "value5" | "fp5" = body.strategy === "fp5" ? "fp5" : "value5";

    // Team settings (cap etc.)
    const { data: settings } = await sb
      .from("team_settings").select("*").eq("team_id", team_id).maybeSingle();
    const salaryCap = settings?.salary_cap ?? 100;
    const fcMin = settings?.starter_fc_min ?? 2;
    const bcMin = settings?.starter_bc_min ?? 2;

    // Load players
    const { data: players, error: pErr } = await sb
      .from("players")
      .select("id, name, team, fc_bc, salary, fp_pg5")
      .eq("league_id", teamLeagueId);
    if (pErr) throw pErr;
    if (!players || players.length === 0) {
      throw new Error(
        "No players available for this league. Import the player file from /commissioner first.",
      );
    }

    // Load last-5 FP from player_game_logs (paginated)
    const logs: any[] = [];
    let off = 0;
    while (true) {
      const { data: batch, error: gErr } = await sb
        .from("player_game_logs")
        .select("player_id, fp, game_date")
        .eq("league_id", teamLeagueId)
        .gt("mp", 0)
        .order("game_date", { ascending: false })
        .range(off, off + 999);
      if (gErr) throw gErr;
      if (!batch || batch.length === 0) break;
      logs.push(...batch);
      if (batch.length < 1000) break;
      off += 1000;
    }
    const last5Map = new Map<number, number[]>();
    for (const l of logs) {
      const arr = last5Map.get(l.player_id) ?? [];
      if (arr.length < 5) { arr.push(Number(l.fp) || 0); last5Map.set(l.player_id, arr); }
    }
    const avg = (a: number[]) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;

    // Pre-season fallback: when no game logs exist for this league yet,
    // we cannot rank by FP/value. Rank by salary as a proxy for talent.
    const hasGameLogs = logs.length > 0;

    type Cand = { id: number; name: string; team: string; fc_bc: string; salary: number; fp5: number; score: number };
    const cands: Cand[] = (players as any[])
      .map((p) => {
        const fp5 = last5Map.has(p.id) ? avg(last5Map.get(p.id)!) : Number(p.fp_pg5) || 0;
        const salary = Number(p.salary) || 0;
        // Pre-season: rank by salary (talent proxy). Otherwise honor strategy.
        const score = !hasGameLogs
          ? salary
          : strategy === "fp5"
            ? fp5
            : (salary > 0 ? fp5 / salary : 0);
        return { id: p.id, name: p.name, team: p.team, fc_bc: p.fc_bc, salary, fp5, score };
      })
      .filter((c) => c.salary > 0 && (c.fc_bc === "FC" || c.fc_bc === "BC"))
      .sort((a, b) => b.score - a.score);

    // Greedy: pick 5 FC + 5 BC, cap $100M, max 2 per NBA team
    const picks: Cand[] = [];
    const teamCounts: Record<string, number> = {};
    let fc = 0, bc = 0, spend = 0;
    for (const c of cands) {
      if (picks.length >= 10) break;
      if (c.fc_bc === "FC" && fc >= 5) continue;
      if (c.fc_bc === "BC" && bc >= 5) continue;
      if ((teamCounts[c.team] ?? 0) >= 2) continue;
      if (spend + c.salary > salaryCap) continue;
      // Ensure we can still afford remaining slots — simple guard: reserve $1 per remaining slot
      const remaining = 10 - picks.length - 1;
      if (spend + c.salary + remaining > salaryCap) continue;
      picks.push(c);
      teamCounts[c.team] = (teamCounts[c.team] ?? 0) + 1;
      spend += c.salary;
      if (c.fc_bc === "FC") fc++; else bc++;
    }

    if (picks.length < 10 || fc !== 5 || bc !== 5) {
      const totalFc = (players as any[]).filter((p) => p.fc_bc === "FC" && Number(p.salary) > 0).length;
      const totalBc = (players as any[]).filter((p) => p.fc_bc === "BC" && Number(p.salary) > 0).length;
      throw new Error(
        `Could not assemble valid roster (picked ${picks.length}: ${fc} FC, ${bc} BC, $${spend.toFixed(1)}M). ` +
        `Player pool has ${totalFc} FC and ${totalBc} BC with salaries set. ` +
        (totalFc < 5 || totalBc < 5
          ? "Run 'Recalculate WNBA Salaries' on the /commissioner page so every player has a salary."
          : ""),
      );
    }

    // Starters: top-5 by fp5 satisfying ≥fcMin FC and ≥bcMin BC.
    // Pre-season: fall back to salary as the ranker.
    const byFp = [...picks].sort((a, b) =>
      hasGameLogs ? b.fp5 - a.fp5 : b.salary - a.salary,
    );
    const starters: Cand[] = [];
    let sFc = 0, sBc = 0;
    for (const c of byFp) {
      if (starters.length >= 5) break;
      const remaining = 5 - starters.length;
      const needFc = Math.max(0, fcMin - sFc);
      const needBc = Math.max(0, bcMin - sBc);
      const reservedForOther = c.fc_bc === "FC" ? needBc : needFc;
      if (remaining - reservedForOther <= 0) continue;
      starters.push(c);
      if (c.fc_bc === "FC") sFc++; else sBc++;
    }
    // Safety fill
    if (starters.length < 5) {
      for (const c of byFp) {
        if (starters.length >= 5) break;
        if (!starters.find((s) => s.id === c.id)) starters.push(c);
      }
    }
    const starterIds = new Set(starters.map((s) => s.id));
    const bench = picks.filter((p) => !starterIds.has(p.id));
    const captain = starters[0]; // highest fp5 starter

    // Persist: wipe and insert
    await sb.from("roster").delete().eq("team_id", team_id);
    const rows = [
      ...starters.map((s) => ({ player_id: s.id, slot: "STARTER", is_captain: s.id === captain.id, gw, day, team_id, league_id: teamLeagueId })),
      ...bench.map((b) => ({ player_id: b.id, slot: "BENCH", is_captain: false, gw, day, team_id, league_id: teamLeagueId })),
    ];
    const { error: insErr } = await sb.from("roster").insert(rows);
    if (insErr) throw insErr;

    return okResponse({
      roster: {
        gw, day, deadline_utc: null,
        starters: starters.map((s) => s.id),
        bench: bench.map((b) => b.id),
        captain_id: captain.id,
        bank_remaining: salaryCap - spend,
        free_transfers_remaining: 2,
        constraints: { salary_cap: salaryCap, starters_count: 5, bench_count: 5, starter_fc_min: fcMin, starter_bc_min: bcMin },
        updated_at: new Date().toISOString(),
        team_id, team_name,
      },
      debug: { strategy, candidates_considered: cands.length, spend, fc, bc },
    });
  } catch (e) {
    return errorResponse("AUTO_PICK_ERROR", e instanceof Error ? e.message : "Unknown", null, 500);
  }
});
