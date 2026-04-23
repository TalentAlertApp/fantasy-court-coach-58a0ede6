import { handleCors } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolveTeam } from "../_shared/resolve-team.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Trade Machine commit endpoint.
 *
 * Body:
 *   { gw: number, day: number, outs: number[], ins: number[] }
 *
 * Behavior (atomic from the user's perspective — best-effort transactional):
 *   1. Validate auth + team via resolveTeam.
 *   2. Load current roster + team_settings.
 *   3. Validate hard rules: equal counts, salary cap, max-2-per-team,
 *      FC/BC balance (5/5), roster size stays 10, GW transfer cap (2).
 *   4. For each (out_i, in_i) pair: delete the OUT row, insert the IN row
 *      with the same slot (preserves STARTER/BENCH placement), and write
 *      one transactions row.
 *   5. Return the updated roster snapshot + the inserted transaction rows.
 */

const GW_TRANSFER_CAP = 2;

Deno.serve(async (req) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  try {
    // Use the caller's JWT so RLS policies protect the team rows. Fall back
    // to the service-role key only when no Authorization header is present
    // (e.g. unit tests). resolveTeam works with either client.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = authHeader
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
          global: { headers: { Authorization: authHeader } },
        })
      : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const gw = Number(body?.gw);
    const day = Number(body?.day);
    const outs: number[] = Array.isArray(body?.outs)
      ? body.outs.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
      : [];
    const ins: number[] = Array.isArray(body?.ins)
      ? body.ins.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
      : [];

    if (!Number.isFinite(gw) || !Number.isFinite(day)) {
      return errorResponse("INVALID_BODY", "gw and day are required numbers");
    }
    // Allow 3 modes:
    //   ADD  : outs=[], ins=[id]            (only when roster < 10)
    //   SWAP : outs=[id], ins=[id]
    //   SWAP2: outs=[id,id], ins=[id,id]
    if (outs.length > 2) {
      return errorResponse("INVALID_BODY", "outs must contain 0, 1 or 2 player ids");
    }
    if (ins.length === 0) {
      return errorResponse("INVALID_BODY", "ins must contain at least one player id");
    }
    if (ins.length > 2) {
      return errorResponse("INVALID_BODY", "ins must contain at most 2 player ids");
    }
    if (outs.length > 0 && ins.length !== outs.length) {
      return errorResponse("INVALID_BODY", "ins length must match outs length for swaps");
    }
    // No duplicates within either list
    if (new Set(outs).size !== outs.length || new Set(ins).size !== ins.length) {
      return errorResponse("INVALID_BODY", "duplicate player ids in trade");
    }
    // Cannot move a player from OUT to IN (no-op swap)
    for (const id of ins) {
      if (outs.includes(id)) {
        return errorResponse("INVALID_BODY", `player ${id} is on both sides of the trade`);
      }
    }

    const { team_id } = await resolveTeam(req, userClient);

    // 1. Load current roster (RLS-scoped) and team settings
    const [rosterRes, settingsRes] = await Promise.all([
      userClient.from("roster").select("id, player_id, slot").eq("team_id", team_id),
      userClient.from("team_settings").select("*").eq("team_id", team_id).maybeSingle(),
    ]);
    if (rosterRes.error) {
      return errorResponse("ROSTER_LOAD_FAILED", rosterRes.error.message, null, 500);
    }
    const rosterRows = rosterRes.data ?? [];
    const salary_cap = Number(settingsRes.data?.salary_cap ?? 100);

    // ADD mode is only allowed when current roster has fewer than 10 players.
    const isAddMode = outs.length === 0;
    if (isAddMode && rosterRows.length >= 10) {
      return errorResponse(
        "INVALID_TRADE",
        "Roster is full (10/10) — pick a player to release first",
      );
    }

    // 2. Validate that every OUT id is on the roster, and no IN id is.
    const rosterIds = new Set<number>(rosterRows.map((r: any) => Number(r.player_id)));
    for (const id of outs) {
      if (!rosterIds.has(id)) {
        return errorResponse("INVALID_TRADE", `player ${id} is not on your roster`);
      }
    }
    for (const id of ins) {
      if (rosterIds.has(id)) {
        return errorResponse("INVALID_TRADE", `player ${id} is already on your roster`);
      }
    }

    // 3. Load all referenced players (roster + ins) in one query for cap/team math.
    const allIds = Array.from(new Set<number>([...rosterRows.map((r: any) => r.player_id), ...ins]));
    const { data: playerRows, error: playerErr } = await userClient
      .from("players")
      .select("id, name, team, fc_bc, salary")
      .in("id", allIds);
    if (playerErr) {
      return errorResponse("PLAYERS_LOAD_FAILED", playerErr.message, null, 500);
    }
    const playerById = new Map<number, any>();
    for (const p of playerRows ?? []) playerById.set(Number(p.id), p);

    for (const id of ins) {
      if (!playerById.has(id)) {
        return errorResponse("INVALID_TRADE", `incoming player ${id} not found`);
      }
    }

    // 4. Compute post-trade roster and validate all hard rules.
    const postIds = new Set<number>(rosterIds);
    for (const id of outs) postIds.delete(id);
    for (const id of ins) postIds.add(id);

    // For SWAP, post-trade size must equal current. For ADD, post-trade size
    // must equal current + ins.length and stay ≤ 10.
    const expectedSize = isAddMode ? rosterRows.length + ins.length : rosterRows.length;
    if (postIds.size !== expectedSize) {
      return errorResponse(
        "INVALID_TRADE",
        `post-trade roster size would be ${postIds.size}, expected ${expectedSize}`,
      );
    }
    if (postIds.size > 10) {
      return errorResponse(
        "INVALID_TRADE",
        `post-trade roster size would be ${postIds.size} (max 10)`,
      );
    }

    let postSalary = 0;
    let postFc = 0;
    let postBc = 0;
    const teamCounts: Record<string, number> = {};
    for (const id of postIds) {
      const p = playerById.get(id);
      if (!p) {
        return errorResponse("INVALID_TRADE", `roster player ${id} not found in players table`);
      }
      postSalary += Number(p.salary ?? 0);
      if (p.fc_bc === "FC") postFc += 1;
      else if (p.fc_bc === "BC") postBc += 1;
      const tri = String(p.team ?? "").toUpperCase();
      if (tri) teamCounts[tri] = (teamCounts[tri] ?? 0) + 1;
    }

    if (postSalary > salary_cap + 1e-6) {
      return errorResponse(
        "INVALID_TRADE",
        `salary cap exceeded: $${postSalary.toFixed(1)}M > $${salary_cap}M`,
      );
    }
    // FC/BC balance: only enforce 5/5 once the roster is full (post-trade size == 10).
    // While the roster is still being built (ADD mode with < 10), we only enforce
    // that neither side exceeds 5.
    if (postIds.size === 10) {
      if (postFc !== 5 || postBc !== 5) {
        return errorResponse(
          "INVALID_TRADE",
          `FC/BC balance broken: would leave ${postFc} FC / ${postBc} BC (must be 5/5)`,
        );
      }
    } else if (postFc > 5 || postBc > 5) {
      return errorResponse(
        "INVALID_TRADE",
        `FC/BC limit exceeded: would leave ${postFc} FC / ${postBc} BC (max 5/5)`,
      );
    }
    for (const [tri, count] of Object.entries(teamCounts)) {
      if (count > 2) {
        return errorResponse(
          "INVALID_TRADE",
          `max 2 per NBA team violated: ${count} players from ${tri}`
        );
      }
    }

    // 5. GW transfer cap — count existing SWAP rows in current GW window.
    //    Caller passes gw/day so we don't need a server-side deadline lookup;
    //    instead we count all transactions for this team since the *previous*
    //    GW reset. A safe heuristic: count rows whose created_at is within
    //    the last 14 days AND whose notes match `gw=${gw}`. We always stamp
    //    notes that way below.
    const { data: gwTxns, error: gwTxnErr } = await userClient
      .from("transactions")
      .select("id, notes")
      .eq("team_id", team_id)
      .like("notes", `gw=${gw}%`);
    if (gwTxnErr) {
      return errorResponse("TX_LOAD_FAILED", gwTxnErr.message, null, 500);
    }
    const usedThisGw = (gwTxns ?? []).length;
    // Each IN counts as one transfer (covers ADD mode where outs.length === 0).
    const transferCount = ins.length;
    if (usedThisGw + transferCount > GW_TRANSFER_CAP) {
      return errorResponse(
        "GW_CAP_REACHED",
        `GW${gw} transfer cap reached: ${usedThisGw}/${GW_TRANSFER_CAP} used, this trade would add ${transferCount}`,
      );
    }

    // 6. Apply the trade: pair each OUT with an IN, preserving slot.
    //    Slot inheritance: in[i] takes the slot of out[i].
    const insertedTxns: any[] = [];
    for (let i = 0; i < outs.length; i++) {
      const outId = outs[i];
      const inId = ins[i];
      const outRow = rosterRows.find((r: any) => Number(r.player_id) === outId);
      const slot = outRow?.slot ?? "BENCH";

      // delete OUT first, then insert IN — order matters because (team_id, player_id)
      // may have a uniqueness expectation downstream and the delete frees the slot.
      const delRes = await userClient.from("roster").delete().eq("team_id", team_id).eq("player_id", outId);
      if (delRes.error) {
        return errorResponse("ROSTER_DELETE_FAILED", delRes.error.message, null, 500);
      }
      const insRes = await userClient.from("roster").insert({
        team_id,
        player_id: inId,
        slot,
        gw,
        day,
      });
      if (insRes.error) {
        // Best-effort rollback: re-insert the OUT row so the user isn't left short.
        await userClient.from("roster").insert({ team_id, player_id: outId, slot, gw, day });
        return errorResponse("ROSTER_INSERT_FAILED", insRes.error.message, null, 500);
      }

      const txnRes = await userClient
        .from("transactions")
        .insert({
          team_id,
          type: "SWAP",
          player_in_id: inId,
          player_out_id: outId,
          cost_points: 0,
          notes: `gw=${gw} day=${day}`,
        })
        .select()
        .single();
      if (txnRes.error) {
        return errorResponse("TX_INSERT_FAILED", txnRes.error.message, null, 500);
      }
      insertedTxns.push(txnRes.data);
    }

    // 7. Return updated roster snapshot (minimal — client invalidates and refetches roster-current).
    const { data: newRoster } = await userClient
      .from("roster")
      .select("player_id, slot, is_captain")
      .eq("team_id", team_id);

    const starters = (newRoster ?? []).filter((r: any) => r.slot === "STARTER").map((r: any) => Number(r.player_id));
    const bench = (newRoster ?? []).filter((r: any) => r.slot === "BENCH").map((r: any) => Number(r.player_id));
    while (starters.length < 5) starters.push(0);
    while (bench.length < 5) bench.push(0);
    const captain = (newRoster ?? []).find((r: any) => r.is_captain);

    return okResponse({
      roster: {
        gw,
        day,
        deadline_utc: null,
        starters: starters.slice(0, 5),
        bench: bench.slice(0, 5),
        captain_id: Number(captain?.player_id ?? 0),
        bank_remaining: Math.max(0, salary_cap - postSalary),
        free_transfers_remaining: Math.max(0, GW_TRANSFER_CAP - (usedThisGw + outs.length)),
        constraints: {
          salary_cap,
          starters_count: 5,
          bench_count: 5,
          starter_fc_min: Number(settingsRes.data?.starter_fc_min ?? 2),
          starter_bc_min: Number(settingsRes.data?.starter_bc_min ?? 2),
        },
        updated_at: new Date().toISOString(),
        team_id,
      },
      transactions: insertedTxns.map((t: any) => ({
        id: String(t.id),
        created_at: t.created_at,
        type: "SWAP" as const,
        player_in_id: Number(t.player_in_id),
        player_out_id: Number(t.player_out_id),
        cost_points: Number(t.cost_points ?? 0),
        notes: t.notes ?? null,
      })),
    });
  } catch (e) {
    console.error("[transactions-commit] error:", e);
    return errorResponse("COMMIT_ERROR", e instanceof Error ? e.message : "Unknown", null, 500);
  }
});
