import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";

const BDL = "https://api.balldontlie.io/v1";
const BATCH = 100;

function round2(n: number): number { return Math.round(n * 100) / 100; }
function computeFP(pts: number, reb: number, ast: number, stl: number, blk: number): number {
  return round2(pts + reb + 2 * ast + 3 * stl + 3 * blk);
}
function currentSeason(): number {
  const now = new Date();
  return now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
}
function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }
function dateStr(d: Date): string { return d.toISOString().slice(0, 10); }
function parseMinDec(min: string | number | null | undefined): number {
  if (!min) return 0;
  if (typeof min === "number") return round2(min);
  const s = String(min).trim();
  if (!s) return 0;
  const parts = s.split(":");
  if (parts.length === 2) return round2(parseInt(parts[0]) + parseInt(parts[1]) / 60);
  return round2(parseFloat(s) || 0);
}
function parseMinInt(min: string | number | null | undefined): number {
  if (!min) return 0;
  if (typeof min === "number") return Math.round(min);
  const s = String(min).trim();
  if (!s) return 0;
  const parts = s.split(":");
  if (parts.length === 2) return parseInt(parts[0]) || 0;
  return Math.round(parseFloat(s) || 0);
}

// ─── BDL API helpers ────────────────────────────────────────────────

async function bdlFetch(path: string, params: URLSearchParams = new URLSearchParams(), retries = 3): Promise<any> {
  const url = new URL(`${BDL}${path}`);
  params.forEach((v, k) => url.searchParams.append(k, v));

  const key = Deno.env.get("BALLDONTLIE_API");
  if (!key) throw new Error("BALLDONTLIE_API secret not configured");

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url.toString(), { headers: { Authorization: key } });
      if (res.status === 429) {
        const wait = Math.min(2000 * Math.pow(2, attempt), 15000);
        console.warn(`[bdl-sync] 429 rate limited, waiting ${wait}ms (attempt ${attempt + 1})`);
        await sleep(wait);
        continue;
      }
      if (res.status >= 500) {
        console.warn(`[bdl-sync] Server error ${res.status}, retrying...`);
        await sleep(1000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`BDL ${res.status}: ${await res.text()}`);
      return await res.json();
    } catch (e) {
      if (attempt === retries - 1) throw e;
      await sleep(1000 * (attempt + 1));
    }
  }
  throw new Error("BDL API unreachable");
}

async function bdlPaginate(path: string, params: Record<string, string> = {}): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | null = null;
  while (true) {
    const sp = new URLSearchParams(params);
    sp.set("per_page", "100");
    if (cursor) sp.set("cursor", cursor);
    const res = await bdlFetch(path, sp);
    all.push(...(res.data || []));
    cursor = res.meta?.next_cursor != null ? String(res.meta.next_cursor) : null;
    if (!cursor || (res.data || []).length === 0) break;
    await sleep(600);
  }
  console.log(`[bdl-sync] ${path}: ${all.length} items`);
  return all;
}

// ─── SYNC PLAYERS ───────────────────────────────────────────────────

async function syncPlayers(
  sb: ReturnType<typeof createClient>,
  counts: Record<string, number>,
  errors: string[],
  updateStep: (s: string) => Promise<void>,
) {
  await updateStep("FETCHING_PLAYERS");
  console.log("[bdl-sync] Fetching players from BDL...");

  // Get existing protected fields
  const { data: existing } = await sb.from("players").select("id, salary, fc_bc, photo, age, dob, exp, college, injury, note");
  const pMap = new Map((existing ?? []).map(p => [p.id, p]));

  const bdlPlayers = await bdlPaginate("/players");

  await updateStep("UPSERTING_PLAYERS");
  const rows = bdlPlayers.map(p => {
    const ex = pMap.get(p.id);
    return {
      id: p.id,
      name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || `Player ${p.id}`,
      team: p.team?.abbreviation ?? "FA",
      pos: p.position ?? null,
      height: p.height ?? null,
      weight: parseInt(p.weight) || ex?.weight || 0,
      jersey: parseInt(p.jersey_number) || ex?.jersey || 0,
      college: (p.college && p.college !== "None") ? p.college : (ex?.college ?? null),
      // Protected fields — never overwrite
      salary: ex?.salary ?? 0,
      fc_bc: ex?.fc_bc ?? "FC",
      photo: ex?.photo ?? null,
      age: ex?.age ?? 0,
      dob: ex?.dob ?? null,
      exp: ex?.exp ?? 0,
      injury: ex?.injury ?? null,
      note: ex?.note ?? null,
      updated_at: new Date().toISOString(),
    };
  });

  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await sb.from("players").upsert(batch, { onConflict: "id", ignoreDuplicates: false });
    if (error) { errors.push(`Player upsert: ${error.message}`); console.error("[bdl-sync]", error.message); }
    else upserted += batch.length;
  }
  counts.players = upserted;
  console.log(`[bdl-sync] Upserted ${upserted} players`);
}

// ─── SYNC GAMES ─────────────────────────────────────────────────────

async function syncGames(
  sb: ReturnType<typeof createClient>,
  season: number,
  counts: Record<string, number>,
  errors: string[],
  updateStep: (s: string) => Promise<void>,
) {
  await updateStep("FETCHING_GAMES");
  const now = new Date();
  const startDate = new Date(now); startDate.setDate(now.getDate() - 7);
  const endDate = new Date(now); endDate.setDate(now.getDate() + 7);
  console.log(`[bdl-sync] Fetching games ${dateStr(startDate)} to ${dateStr(endDate)}`);

  const bdlGames = await bdlPaginate("/games", {
    start_date: dateStr(startDate),
    end_date: dateStr(endDate),
  });

  await updateStep("UPSERTING_GAMES");
  const rows = bdlGames.map(g => {
    const gDate = typeof g.date === "string" ? g.date.slice(0, 10) : null;
    const statusMap: Record<string, string> = { "Final": "FINAL", "In Progress": "LIVE" };
    return {
      game_id: `bdl:${g.id}`,
      balldontlie_game_id: g.id,
      game_date: gDate,
      date_utc: g.datetime ?? (gDate ? `${gDate}T00:00:00+00:00` : null),
      season: g.season ?? season,
      home_team: g.home_team?.abbreviation ?? "",
      away_team: g.visitor_team?.abbreviation ?? "",
      home_team_abbr: g.home_team?.abbreviation ?? "",
      away_team_abbr: g.visitor_team?.abbreviation ?? "",
      home_pts: g.home_team_score ?? 0,
      away_pts: g.visitor_team_score ?? 0,
      status: statusMap[g.status] ?? "SCHEDULED",
      nba_game_url: null,
      updated_at: new Date().toISOString(),
    };
  });

  let upserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await sb.from("games").upsert(batch, { onConflict: "game_id", ignoreDuplicates: false });
    if (error) { errors.push(`Games upsert: ${error.message}`); console.error("[bdl-sync]", error.message); }
    else upserted += batch.length;
  }
  counts.games = upserted;
  console.log(`[bdl-sync] Upserted ${upserted} games`);
}

// ─── SYNC STATS ─────────────────────────────────────────────────────

async function syncStats(
  sb: ReturnType<typeof createClient>,
  season: number,
  counts: Record<string, number>,
  errors: string[],
  updateStep: (s: string) => Promise<void>,
) {
  // Step 1: Fetch team lookup
  await updateStep("FETCHING_TEAMS_LOOKUP");
  let teamMap = new Map<number, string>();
  try {
    const teamsRes = await bdlFetch("/teams");
    for (const t of (teamsRes.data || [])) teamMap.set(t.id, t.abbreviation);
  } catch (e) { console.warn("[bdl-sync] Teams lookup failed, continuing without"); }

  // Step 2: Get player IDs from DB
  const { data: dbPlayers } = await sb.from("players").select("id, salary, fp_pg_t, fp_pg5");
  const playerIds = (dbPlayers ?? []).map(p => p.id);
  const salaryMap = new Map((dbPlayers ?? []).map(p => [p.id, p.salary]));
  console.log(`[bdl-sync] ${playerIds.length} players in DB`);

  // Step 3: Fetch season averages
  await updateStep("FETCHING_SEASON_AVERAGES");
  const seasonAvgMap = new Map<number, any>();
  try {
    for (let i = 0; i < playerIds.length; i += 100) {
      const batch = playerIds.slice(i, i + 100);
      const sp = new URLSearchParams();
      sp.set("season", String(season));
      for (const id of batch) sp.append("player_ids[]", String(id));
      const res = await bdlFetch("/season_averages", sp);
      for (const avg of (res.data || [])) seasonAvgMap.set(avg.player_id, avg);
      await sleep(600);
    }
    console.log(`[bdl-sync] Season averages for ${seasonAvgMap.size} players`);
  } catch (e) {
    const msg = `Season averages failed: ${e instanceof Error ? e.message : String(e)}`;
    console.warn(`[bdl-sync] ${msg}`);
    errors.push(msg);
  }

  // Step 4: Update players with season stats
  await updateStep("UPSERTING_SEASON_STATS");
  if (seasonAvgMap.size > 0) {
    const seasonRows: any[] = [];
    for (const [pid, avg] of seasonAvgMap) {
      const pts = avg.pts ?? 0;
      const reb = avg.reb ?? 0;
      const ast = avg.ast ?? 0;
      const stl = avg.stl ?? 0;
      const blk = avg.blk ?? 0;
      const fp = computeFP(pts, reb, ast, stl, blk);
      const sal = salaryMap.get(pid) ?? 0;
      seasonRows.push({
        id: pid,
        gp: avg.games_played ?? 0,
        mpg: parseMinDec(avg.min),
        pts: round2(pts), reb: round2(reb), ast: round2(ast),
        stl: round2(stl), blk: round2(blk),
        fp_pg_t: fp,
        stocks: round2(stl + blk),
        value_t: sal > 0 ? round2(fp / sal) : 0,
        updated_at: new Date().toISOString(),
      });
    }
    for (let i = 0; i < seasonRows.length; i += BATCH) {
      const batch = seasonRows.slice(i, i + BATCH);
      const { error } = await sb.from("players").upsert(batch, { onConflict: "id", ignoreDuplicates: false });
      if (error) errors.push(`Season stats upsert: ${error.message}`);
    }
    counts.season_averages = seasonRows.length;
  }

  // Step 5: Fetch recent game logs
  await updateStep("FETCHING_GAME_LOGS");
  const now = new Date();
  const startDate = new Date(now); startDate.setDate(now.getDate() - 21);
  console.log(`[bdl-sync] Fetching stats from ${dateStr(startDate)} to ${dateStr(now)}`);

  const allStats = await bdlPaginate("/stats", {
    start_date: dateStr(startDate),
    end_date: dateStr(now),
  });

  // Step 6: Upsert player_game_logs
  await updateStep("UPSERTING_GAME_LOGS");
  const logRows: any[] = [];
  for (const stat of allStats) {
    const pid = stat.player?.id;
    const gid = stat.game?.id;
    if (!pid || !gid) continue;

    const playerTeamId = stat.team?.id;
    const isHome = playerTeamId === stat.game?.home_team_id;
    const homeAbbr = teamMap.get(stat.game?.home_team_id) ?? "";
    const visitorAbbr = teamMap.get(stat.game?.visitor_team_id) ?? "";
    const oppAbbr = isHome ? visitorAbbr : homeAbbr;
    const playerAbbr = isHome ? homeAbbr : visitorAbbr;
    const homeAway = isHome ? "H" : "A";
    const matchup = isHome ? `${playerAbbr} vs. ${oppAbbr}` : `${playerAbbr} @ ${oppAbbr}`;
    const gDate = typeof stat.game?.date === "string" ? stat.game.date.slice(0, 10) : null;

    const pts = stat.pts ?? 0, reb = stat.reb ?? 0, ast = stat.ast ?? 0;
    const stl = stat.stl ?? 0, blk = stat.blk ?? 0;

    logRows.push({
      player_id: pid,
      game_id: `bdl:${gid}`,
      balldontlie_game_id: gid,
      game_date: gDate,
      matchup, opp: oppAbbr || null, home_away: homeAway,
      mp: parseMinInt(stat.min),
      pts, reb, ast, stl, blk,
      fp: computeFP(pts, reb, ast, stl, blk),
      nba_game_url: null,
      updated_at: new Date().toISOString(),
    });
  }

  let logCount = 0;
  for (let i = 0; i < logRows.length; i += BATCH) {
    const batch = logRows.slice(i, i + BATCH);
    const { error } = await sb.from("player_game_logs").upsert(batch, { onConflict: "player_id,game_id", ignoreDuplicates: false });
    if (error) errors.push(`Game log upsert: ${error.message}`);
    else logCount += batch.length;
  }
  counts.game_logs = logCount;
  console.log(`[bdl-sync] Upserted ${logCount} game logs`);

  // Step 7: Compute last-5 averages from DB
  await updateStep("COMPUTING_LAST5");
  const { data: recentLogs } = await sb
    .from("player_game_logs")
    .select("player_id, mp, pts, reb, ast, stl, blk, fp, game_date")
    .order("game_date", { ascending: false })
    .limit(5000);

  const logsByPlayer = new Map<number, typeof recentLogs>();
  for (const log of (recentLogs ?? [])) {
    if (!logsByPlayer.has(log.player_id)) logsByPlayer.set(log.player_id, []);
    const arr = logsByPlayer.get(log.player_id)!;
    if (arr.length < 5) arr.push(log);
  }

  const last5Updates: any[] = [];
  for (const [pid, logs] of logsByPlayer) {
    if (logs.length === 0) continue;
    const n = logs.length;
    let mpg5 = 0, pts5 = 0, reb5 = 0, ast5 = 0, stl5 = 0, blk5 = 0, fp5 = 0;
    for (const l of logs) {
      mpg5 += l.mp; pts5 += l.pts; reb5 += l.reb;
      ast5 += l.ast; stl5 += l.stl; blk5 += l.blk; fp5 += l.fp;
    }
    mpg5 = round2(mpg5 / n); pts5 = round2(pts5 / n); reb5 = round2(reb5 / n);
    ast5 = round2(ast5 / n); stl5 = round2(stl5 / n); blk5 = round2(blk5 / n);
    fp5 = round2(fp5 / n);

    // Get current season stats for deltas
    const seasonAvg = seasonAvgMap.get(pid);
    const seasonMpg = seasonAvg ? parseMinDec(seasonAvg.min) : 0;
    const seasonFp = seasonAvg ? computeFP(seasonAvg.pts ?? 0, seasonAvg.reb ?? 0, seasonAvg.ast ?? 0, seasonAvg.stl ?? 0, seasonAvg.blk ?? 0) : 0;

    const sal = salaryMap.get(pid) ?? 0;
    last5Updates.push({
      id: pid,
      mpg5, pts5, reb5, ast5, stl5, blk5,
      fp_pg5: fp5,
      stocks5: round2(stl5 + blk5),
      delta_mpg: round2(mpg5 - seasonMpg),
      delta_fp: round2(fp5 - seasonFp),
      value5: sal > 0 ? round2(fp5 / sal) : 0,
      updated_at: new Date().toISOString(),
    });
  }

  for (let i = 0; i < last5Updates.length; i += BATCH) {
    const batch = last5Updates.slice(i, i + BATCH);
    const { error } = await sb.from("players").upsert(batch, { onConflict: "id", ignoreDuplicates: false });
    if (error) errors.push(`Last5 update: ${error.message}`);
  }
  counts.last5_updates = last5Updates.length;

  // Step 8: Update player_last_game
  await updateStep("UPSERTING_LAST_GAMES");
  const lastGameRows: any[] = [];
  for (const [pid, logs] of logsByPlayer) {
    const lg = logs[0]; // most recent
    if (!lg) continue;
    // Try to get game scores from games table
    const gameId = `bdl:${logRows.find(r => r.player_id === pid && r.game_date === lg.game_date)?.balldontlie_game_id ?? ""}`;
    const { data: gameData } = await sb.from("games").select("home_pts, away_pts, home_team, away_team").eq("game_id", gameId).maybeSingle();

    const opp = logRows.find(r => r.player_id === pid && r.game_date === lg.game_date)?.opp ?? null;
    const homeAway = logRows.find(r => r.player_id === pid && r.game_date === lg.game_date)?.home_away ?? null;
    const hPts = gameData?.home_pts ?? 0;
    const aPts = gameData?.away_pts ?? 0;
    let result: string | null = null;
    if (hPts > 0 || aPts > 0) {
      if (homeAway === "H") result = hPts > aPts ? "W" : "L";
      else if (homeAway === "A") result = aPts > hPts ? "W" : "L";
    }

    lastGameRows.push({
      player_id: pid,
      game_date: lg.game_date,
      opp, home_away: homeAway, result,
      a_pts: aPts, h_pts: hPts,
      mp: lg.mp, pts: lg.pts, reb: lg.reb,
      ast: lg.ast, stl: lg.stl, blk: lg.blk,
      fp: lg.fp, nba_game_url: null,
      updated_at: new Date().toISOString(),
    });
  }

  // Batch upsert — don't query games table per player (too slow)
  // Instead, batch upsert directly
  let lastGameCount = 0;
  for (let i = 0; i < lastGameRows.length; i += BATCH) {
    const batch = lastGameRows.slice(i, i + BATCH);
    const { error } = await sb.from("player_last_game").upsert(batch, { onConflict: "player_id", ignoreDuplicates: false });
    if (error) errors.push(`Last game upsert: ${error.message}`);
    else lastGameCount += batch.length;
  }
  counts.last_games = lastGameCount;
  console.log(`[bdl-sync] Updated ${last5Updates.length} last-5, ${lastGameCount} last games`);
}

// ─── MAIN HANDLER ───────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", "POST only", null, 405);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let runId: string | null = null;

  try {
    const body = await req.json();
    const syncType: string = body.type ?? "FULL";
    const season = currentSeason();

    console.log(`[bdl-sync] Starting ${syncType} sync, season=${season}`);

    const { data: run } = await sb.from("sync_runs").insert({
      type: syncType, status: "RUNNING",
      details: { step: "STARTING", source: "balldontlie" },
    }).select("id").single();
    runId = run?.id ?? null;

    const counts: Record<string, number> = {};
    const errors: string[] = [];

    const updateStep = async (step: string) => {
      if (runId) {
        await sb.from("sync_runs").update({
          details: { step, counts, errors, source: "balldontlie" },
        }).eq("id", runId).then(null, () => {});
      }
    };

    if (syncType === "FULL" || syncType === "PLAYERS") {
      await syncPlayers(sb, counts, errors, updateStep);
    }
    if (syncType === "FULL" || syncType === "GAMES") {
      await syncGames(sb, season, counts, errors, updateStep);
    }
    if (syncType === "FULL" || syncType === "STATS") {
      await syncStats(sb, season, counts, errors, updateStep);
    }

    await updateStep("DONE");
    if (runId) {
      await sb.from("sync_runs").update({
        status: errors.length > 0 ? "PARTIAL" : "SUCCESS",
        finished_at: new Date().toISOString(),
        details: { step: "DONE", counts, errors, source: "balldontlie" },
      }).eq("id", runId);
    }

    console.log(`[bdl-sync] Completed. Counts:`, counts, `Errors:`, errors.length);
    return okResponse({ run_id: runId, status: errors.length > 0 ? "PARTIAL" : "SUCCESS", counts, errors });
  } catch (e) {
    console.error("[bdl-sync] Fatal:", e);
    if (runId) {
      await sb.from("sync_runs").update({
        status: "FAILED", finished_at: new Date().toISOString(),
        details: { error: e instanceof Error ? e.message : String(e), step: "FAILED" },
      }).eq("id", runId).then(null, () => {});
    }
    return errorResponse("SYNC_ERROR", e instanceof Error ? e.message : "Unknown error", null, 500);
  }
});
