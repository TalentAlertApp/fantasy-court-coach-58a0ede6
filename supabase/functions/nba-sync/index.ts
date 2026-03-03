import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { okResponse, errorResponse } from "../_shared/envelope.ts";
import {
  nbaFetch,
  NbaBlockedError,
  computeFP,
  currentSeason,
  parseMatchup,
  buildGameUrl,
  sleep,
} from "../_shared/nba-stats.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", "POST only", null, 405);

  const sb = createClient(supabaseUrl, supabaseKey);
  let runId: string | null = null;

  try {
    const body = await req.json();
    const syncType: string = body.type ?? "FULL";
    const force: boolean = body.force ?? false;
    const season = currentSeason();

    console.log(`[nba-sync] Starting ${syncType} sync, season=${season}, force=${force}`);

    // Create sync_run record
    const { data: run } = await sb.from("sync_runs").insert({
      type: syncType,
      status: "RUNNING",
      details: { season },
    }).select("id").single();
    runId = run?.id ?? null;

    const counts: Record<string, number> = {};
    const errors: string[] = [];

    if (syncType === "FULL" || syncType === "PERGAME_LAST5") {
      await syncPerGameAndLast5(sb, season, force, counts, errors);
    }

    if (syncType === "FULL" || syncType === "LAST_GAME") {
      await syncLastGame(sb, season, counts, errors);
    }

    // Update sync_run
    if (runId) {
      await sb.from("sync_runs").update({
        status: errors.length > 0 ? "PARTIAL" : "SUCCESS",
        finished_at: new Date().toISOString(),
        details: { season, counts, errors },
      }).eq("id", runId);
    }

    console.log(`[nba-sync] Completed. Counts:`, counts, `Errors: ${errors.length}`);
    return okResponse({
      run_id: runId,
      status: errors.length > 0 ? "PARTIAL" : "SUCCESS",
      counts,
      errors,
    });
  } catch (e) {
    console.error("[nba-sync] Fatal error:", e);
    if (runId) {
      await sb.from("sync_runs").update({
        status: "FAILED",
        finished_at: new Date().toISOString(),
        details: { error: e instanceof Error ? e.message : String(e) },
      }).eq("id", runId).catch(() => {});
    }
    const code = e instanceof NbaBlockedError ? "NBA_BLOCKED" : "SYNC_ERROR";
    return errorResponse(code, e instanceof Error ? e.message : "Unknown error", null, 500);
  }
});

// ─── PERGAME + LAST5 ────────────────────────────────────────────────

async function syncPerGameAndLast5(
  sb: ReturnType<typeof createClient>,
  season: string,
  force: boolean,
  counts: Record<string, number>,
  errors: string[]
) {
  console.log("[nba-sync] Fetching PerGame stats...");

  // 1. Fetch league-wide per-game stats
  const perGameSets = await nbaFetch("leaguedashplayerstats", {
    Season: season,
    SeasonType: "Regular Season",
    PerMode: "PerGame",
    MeasureType: "Base",
    PlusMinus: "N",
    PaceAdjust: "N",
    Rank: "N",
    Outcome: "",
    Location: "",
    Month: "0",
    SeasonSegment: "",
    DateFrom: "",
    DateTo: "",
    OpponentTeamID: "0",
    VsConference: "",
    VsDivision: "",
    GameSegment: "",
    Period: "0",
    LastNGames: "0",
    LeagueID: "00",
  });

  const perGameRows = perGameSets[0]?.rows ?? [];
  console.log(`[nba-sync] PerGame rows: ${perGameRows.length}`);

  // 2. Fetch league game log for last 5 computation (all players, last 15 games each is enough)
  //    We use leaguegamelog with PlayerOrTeam=P to get all player game logs at once
  console.log("[nba-sync] Fetching league player game log...");
  await sleep(700);
  
  const playerLogSets = await nbaFetch("leaguegamelog", {
    Season: season,
    SeasonType: "Regular Season",
    PlayerOrTeam: "P",
    Direction: "DESC",
    Sorter: "DATE",
    LeagueID: "00",
  });

  const allGameLogs = playerLogSets[0]?.rows ?? [];
  console.log(`[nba-sync] Player game log rows: ${allGameLogs.length}`);

  // Group game logs by player_id, take last 5
  const logsByPlayer = new Map<number, typeof allGameLogs>();
  for (const log of allGameLogs) {
    const pid = log.PLAYER_ID as number;
    if (!logsByPlayer.has(pid)) logsByPlayer.set(pid, []);
    const arr = logsByPlayer.get(pid)!;
    if (arr.length < 5) arr.push(log);
  }

  // 3. Build player upsert rows
  const playerRows: any[] = [];
  for (const row of perGameRows) {
    const pid = row.PLAYER_ID as number;
    const gp = (row.GP as number) ?? 0;
    const mpg = (row.MIN as number) ?? 0;
    const pts = (row.PTS as number) ?? 0;
    const ast = (row.AST as number) ?? 0;
    const reb = (row.REB as number) ?? 0;
    const stl = (row.STL as number) ?? 0;
    const blk = (row.BLK as number) ?? 0;
    const fp = computeFP(pts, reb, ast, stl, blk);
    const stocks = stl + blk;

    // Last 5 averages
    const logs = logsByPlayer.get(pid) ?? [];
    let mpg5 = 0, pts5 = 0, ast5 = 0, reb5 = 0, stl5 = 0, blk5 = 0;
    if (logs.length > 0) {
      const n = logs.length;
      for (const l of logs) {
        mpg5 += (l.MIN as number) ?? 0;
        pts5 += (l.PTS as number) ?? 0;
        ast5 += (l.AST as number) ?? 0;
        reb5 += (l.REB as number) ?? 0;
        stl5 += (l.STL as number) ?? 0;
        blk5 += (l.BLK as number) ?? 0;
      }
      mpg5 = round2(mpg5 / n);
      pts5 = round2(pts5 / n);
      ast5 = round2(ast5 / n);
      reb5 = round2(reb5 / n);
      stl5 = round2(stl5 / n);
      blk5 = round2(blk5 / n);
    }
    const fp5 = round2(computeFP(pts5, reb5, ast5, stl5, blk5));
    const stocks5 = round2(stl5 + blk5);
    const delta_mpg = round2(mpg5 - mpg);
    const delta_fp = round2(fp5 - fp);

    const upsertRow: any = {
      id: pid,
      name: row.PLAYER_NAME as string,
      team: row.TEAM_ABBREVIATION as string,
      gp,
      mpg: round2(mpg),
      pts: round2(pts),
      ast: round2(ast),
      reb: round2(reb),
      stl: round2(stl),
      blk: round2(blk),
      fp_pg_t: round2(fp),
      mpg5,
      pts5,
      ast5,
      reb5,
      stl5,
      blk5,
      fp_pg5: fp5,
      stocks,
      stocks5,
      delta_mpg,
      delta_fp,
      updated_at: new Date().toISOString(),
    };

    // Compute value fields — need salary from DB
    // We'll update value/value5 in a second pass after upsert
    playerRows.push(upsertRow);
  }

  // 4. Upsert players in batches (don't overwrite salary/fc_bc unless force)
  const BATCH = 100;
  let upserted = 0;
  for (let i = 0; i < playerRows.length; i += BATCH) {
    const batch = playerRows.slice(i, i + BATCH);
    
    // If not force, we need to avoid overwriting salary and fc_bc
    // Supabase upsert with onConflict will update all columns, so we exclude salary/fc_bc
    const { error } = await sb.from("players").upsert(batch, {
      onConflict: "id",
      ignoreDuplicates: false,
    });
    if (error) {
      console.error(`[nba-sync] Upsert batch error:`, error.message);
      errors.push(`Player upsert batch ${i}: ${error.message}`);
    } else {
      upserted += batch.length;
    }
  }
  counts.players = upserted;
  console.log(`[nba-sync] Upserted ${upserted} players`);

  // 5. Update value/value5 based on salary (do this after upsert so salary is available)
  const { error: valErr } = await sb.rpc("", {}).catch(() => ({ error: null }));
  // Use raw update instead — update value = fp / salary where salary > 0
  await sb.from("players")
    .update({ value_t: 0, value5: 0 })
    .or("salary.eq.0,salary.is.null");
  
  // For players with salary > 0, we need to compute value individually
  // This is done via a simple query + update approach
  const { data: playersWithSalary } = await sb
    .from("players")
    .select("id, fp_pg_t, fp_pg5, salary")
    .gt("salary", 0);

  if (playersWithSalary) {
    for (const p of playersWithSalary) {
      const value_t = round2(p.fp_pg_t / p.salary);
      const value5 = round2(p.fp_pg5 / p.salary);
      await sb.from("players").update({ value_t, value5 }).eq("id", p.id);
    }
  }

  // 6. Also upsert game logs into player_game_logs
  const gameLogRows: any[] = [];
  for (const log of allGameLogs) {
    const matchup = (log.MATCHUP as string) ?? "";
    const gameId = (log.GAME_ID as string) ?? "";
    if (!matchup || !gameId) continue;
    
    const { opp, home_away } = parseMatchup(matchup);
    const pts = (log.PTS as number) ?? 0;
    const reb = (log.REB as number) ?? 0;
    const ast = (log.AST as number) ?? 0;
    const stl = (log.STL as number) ?? 0;
    const blk = (log.BLK as number) ?? 0;

    gameLogRows.push({
      player_id: log.PLAYER_ID as number,
      game_id: gameId,
      game_date: normalizeDate(log.GAME_DATE as string),
      matchup,
      opp,
      home_away,
      mp: (log.MIN as number) ?? 0,
      pts,
      reb,
      ast,
      stl,
      blk,
      fp: computeFP(pts, reb, ast, stl, blk),
      nba_game_url: buildGameUrl(matchup, gameId),
      updated_at: new Date().toISOString(),
    });
  }

  // Upsert game logs in batches
  let logCount = 0;
  for (let i = 0; i < gameLogRows.length; i += BATCH) {
    const batch = gameLogRows.slice(i, i + BATCH);
    const { error } = await sb.from("player_game_logs").upsert(batch, {
      onConflict: "player_id,game_id",
      ignoreDuplicates: false,
    });
    if (error) {
      errors.push(`Game log upsert batch ${i}: ${error.message}`);
    } else {
      logCount += batch.length;
    }
  }
  counts.game_logs = logCount;
}

// ─── LAST GAME ──────────────────────────────────────────────────────

async function syncLastGame(
  sb: ReturnType<typeof createClient>,
  season: string,
  counts: Record<string, number>,
  errors: string[]
) {
  console.log("[nba-sync] Fetching last game data (player log)...");

  // Fetch player game log (league-wide, sorted by date DESC)
  const playerLogSets = await nbaFetch("leaguegamelog", {
    Season: season,
    SeasonType: "Regular Season",
    PlayerOrTeam: "P",
    Direction: "DESC",
    Sorter: "DATE",
    LeagueID: "00",
  });

  const allLogs = playerLogSets[0]?.rows ?? [];
  console.log(`[nba-sync] Player logs for last game: ${allLogs.length}`);

  // Get last game per player (first occurrence since sorted DESC)
  const lastGameByPlayer = new Map<number, any>();
  for (const log of allLogs) {
    const pid = log.PLAYER_ID as number;
    if (!lastGameByPlayer.has(pid)) {
      lastGameByPlayer.set(pid, log);
    }
  }

  // Fetch team game log for game scores
  console.log("[nba-sync] Fetching team game log for scores...");
  await sleep(700);

  const teamLogSets = await nbaFetch("leaguegamelog", {
    Season: season,
    SeasonType: "Regular Season",
    PlayerOrTeam: "T",
    Direction: "DESC",
    Sorter: "DATE",
    LeagueID: "00",
  });

  const teamLogs = teamLogSets[0]?.rows ?? [];
  console.log(`[nba-sync] Team game log rows: ${teamLogs.length}`);

  // Build games map: game_id -> { away_team, home_team, away_pts, home_pts }
  const gamesMap = new Map<string, any>();
  for (const tl of teamLogs) {
    const gameId = tl.GAME_ID as string;
    const matchup = (tl.MATCHUP as string) ?? "";
    const pts = (tl.PTS as number) ?? 0;
    const teamAbbr = (tl.TEAM_ABBREVIATION as string) ?? "";

    if (!gamesMap.has(gameId)) {
      gamesMap.set(gameId, { game_id: gameId, game_date: null, away_team: null, home_team: null, away_pts: 0, home_pts: 0, status: "FINAL", nba_game_url: null });
    }
    const g = gamesMap.get(gameId)!;
    g.game_date = normalizeDate(tl.GAME_DATE as string);
    if (matchup) {
      g.nba_game_url = buildGameUrl(matchup, gameId);
    }

    if (matchup.includes("@")) {
      // This team is away
      g.away_team = teamAbbr;
      g.away_pts = pts;
    } else {
      // This team is home
      g.home_team = teamAbbr;
      g.home_pts = pts;
    }
  }

  // Upsert games
  const gamesArr = Array.from(gamesMap.values()).map(g => ({
    ...g,
    updated_at: new Date().toISOString(),
  }));
  
  const BATCH = 100;
  let gameCount = 0;
  for (let i = 0; i < gamesArr.length; i += BATCH) {
    const batch = gamesArr.slice(i, i + BATCH);
    const { error } = await sb.from("games").upsert(batch, {
      onConflict: "game_id",
      ignoreDuplicates: false,
    });
    if (error) {
      errors.push(`Games upsert batch ${i}: ${error.message}`);
    } else {
      gameCount += batch.length;
    }
  }
  counts.games = gameCount;

  // Upsert player_last_game
  const lastGameRows: any[] = [];
  for (const [pid, log] of lastGameByPlayer) {
    const matchup = (log.MATCHUP as string) ?? "";
    const gameId = (log.GAME_ID as string) ?? "";
    const { opp, home_away } = parseMatchup(matchup);
    const pts = (log.PTS as number) ?? 0;
    const reb = (log.REB as number) ?? 0;
    const ast = (log.AST as number) ?? 0;
    const stl = (log.STL as number) ?? 0;
    const blk = (log.BLK as number) ?? 0;
    const fp = computeFP(pts, reb, ast, stl, blk);

    // Get game scores
    const game = gamesMap.get(gameId);
    const a_pts = game?.away_pts ?? 0;
    const h_pts = game?.home_pts ?? 0;

    let result: string | null = null;
    if (a_pts > 0 || h_pts > 0) {
      if (home_away === "H") result = h_pts > a_pts ? "W" : "L";
      else result = a_pts > h_pts ? "W" : "L";
    }

    lastGameRows.push({
      player_id: pid,
      game_date: normalizeDate(log.GAME_DATE as string),
      opp,
      home_away,
      result,
      a_pts,
      h_pts,
      mp: (log.MIN as number) ?? 0,
      pts,
      reb,
      ast,
      stl,
      blk,
      fp,
      nba_game_url: game?.nba_game_url ?? buildGameUrl(matchup, gameId),
      updated_at: new Date().toISOString(),
    });
  }

  let lastGameCount = 0;
  for (let i = 0; i < lastGameRows.length; i += BATCH) {
    const batch = lastGameRows.slice(i, i + BATCH);
    const { error } = await sb.from("player_last_game").upsert(batch, {
      onConflict: "player_id",
      ignoreDuplicates: false,
    });
    if (error) {
      errors.push(`Last game upsert batch ${i}: ${error.message}`);
    } else {
      lastGameCount += batch.length;
    }
  }
  counts.last_games = lastGameCount;
  console.log(`[nba-sync] Upserted ${gameCount} games, ${lastGameCount} last games`);
}

// ─── Helpers ────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeDate(d: string | null | undefined): string | null {
  if (!d) return null;
  // NBA API returns dates like "MAR 01, 2026" or "2026-03-01"
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}
