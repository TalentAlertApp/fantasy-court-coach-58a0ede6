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
      details: { season, step: "STARTING", source: "nba" },
    }).select("id").single();
    runId = run?.id ?? null;

    const counts: Record<string, number> = {};
    const errors: string[] = [];
    let source = "nba";

    const updateStep = async (step: string) => {
      if (runId) {
        await sb.from("sync_runs").update({
          details: { season, step, counts, errors, source },
        }).eq("id", runId).catch(() => {});
      }
    };

    try {
      if (syncType === "FULL" || syncType === "PERGAME_LAST5") {
        await syncPerGameAndLast5(sb, season, force, counts, errors, updateStep);
      }

      if (syncType === "FULL" || syncType === "LAST_GAME") {
        await syncLastGame(sb, season, counts, errors, updateStep);
      }
    } catch (nbaErr) {
      if (nbaErr instanceof NbaBlockedError) {
        console.warn("[nba-sync] NBA API blocked, falling back to Google Sheet...");
        source = "sheet";
        await updateStep("SHEET_FALLBACK");
        await sheetFallbackSync(sb, counts, errors);
      } else {
        throw nbaErr;
      }
    }

    // Update sync_run
    await updateStep("DONE");
    if (runId) {
      await sb.from("sync_runs").update({
        status: errors.length > 0 ? "PARTIAL" : "SUCCESS",
        finished_at: new Date().toISOString(),
        details: { season, step: "DONE", counts, errors, source },
      }).eq("id", runId);
    }

    console.log(`[nba-sync] Completed (source=${source}). Counts:`, counts);
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
        details: { error: e instanceof Error ? e.message : String(e), step: "FAILED" },
      }).eq("id", runId).catch(() => {});
    }
    const code = e instanceof NbaBlockedError ? "NBA_BLOCKED" : "SYNC_ERROR";
    return errorResponse(code, e instanceof Error ? e.message : "Unknown error", null, 500);
  }
});

// ─── GOOGLE SHEET FALLBACK ─────────────────────────────────────────
async function sheetFallbackSync(
  sb: ReturnType<typeof createClient>,
  counts: Record<string, number>,
  errors: string[]
) {
  console.log("[nba-sync] Running Google Sheet fallback sync...");

  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  const sheetId = Deno.env.get("GSHEET_ID");
  if (!saJson || !sheetId) {
    errors.push("Sheet fallback unavailable: missing GOOGLE_SERVICE_ACCOUNT_JSON or GSHEET_ID");
    return;
  }

  // Inline sheet helpers (from sync-sheet)
  function euNum(v: string | undefined | null): number { if (!v || v.trim() === "" || v === "-") return 0; return Number(v.replace(",", ".")) || 0; }
  function euInt(v: string | undefined | null): number { return Math.round(euNum(v)); }
  function nullable(v: string | undefined | null): string | null { if (!v || v.trim() === "" || v === "None") return null; return v; }
  function normDate(v: string | undefined | null): string | null {
    if (!v || v.trim() === "") return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const p = v.split("/"); if (p.length === 3) return `${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;
    return null;
  }
  function parseOpp(v: string | undefined | null) {
    if (!v || v.trim() === "") return { opp: null, home_away: null };
    const t = v.trim();
    return t.startsWith("@") ? { opp: t.slice(1), home_away: "A" as const } : { opp: t, home_away: "H" as const };
  }
  function base64url(input: Uint8Array): string { let b = ""; for (const byte of input) b += String.fromCharCode(byte); return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function strToB64(s: string) { return base64url(new TextEncoder().encode(s)); }

  async function getAccessToken(sa: any) {
    const now = Math.floor(Date.now() / 1000);
    const h = strToB64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const c = strToB64(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/spreadsheets.readonly", aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now }));
    const unsigned = `${h}.${c}`;
    const pem = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\n/g, "");
    const bk = Uint8Array.from(atob(pem), (c: string) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("pkcs8", bk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
    const jwt = `${unsigned}.${base64url(new Uint8Array(sig))}`;
    const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
    const d = await r.json(); if (!d.access_token) throw new Error(`Token: ${JSON.stringify(d)}`);
    return d.access_token;
  }

  async function fetchSheetRows(range = "A:AV"): Promise<string[][]> {
    const token = await getAccessToken(JSON.parse(saJson!));
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Sheets ${r.status}: ${await r.text()}`);
    const d = await r.json(); return (d.values || []) as string[][];
  }

  try {
    const rows = await fetchSheetRows();
    const dataRows = rows.slice(1).filter((r) => r[0] && r[0].trim() !== "");

    // Build player rows
    const playerRows = dataRows.map((row) => {
      const col = (i: number) => row[i] ?? "";
      const fcBc = col(4).trim().toUpperCase();
      return {
        id: euInt(col(0)), name: col(2), team: col(3),
        fc_bc: fcBc === "BC" ? "BC" : "FC",
        photo: nullable(col(1)), salary: euNum(col(5)), jersey: euInt(col(6)),
        pos: nullable(col(13)), height: nullable(col(9)), weight: euInt(col(8)),
        age: euInt(col(10)), dob: normDate(col(11)), exp: euInt(col(12)), college: nullable(col(7)),
        gp: euInt(col(14)), mpg: euNum(col(15)), pts: euNum(col(16)), reb: euNum(col(18)),
        ast: euNum(col(17)), stl: euNum(col(20)), blk: euNum(col(19)),
        fp_pg_t: euNum(col(21)), value_t: euNum(col(23)),
        mpg5: euNum(col(25)), pts5: euNum(col(26)), reb5: euNum(col(28)),
        ast5: euNum(col(27)), stl5: euNum(col(30)), blk5: euNum(col(29)),
        fp_pg5: euNum(col(31)), value5: euNum(col(33)),
        injury: null, note: null,
        updated_at: new Date().toISOString(),
      };
    });

    let upsertedPlayers = 0;
    for (let i = 0; i < playerRows.length; i += 50) {
      const batch = playerRows.slice(i, i + 50);
      const { error } = await sb.from("players").upsert(batch, { onConflict: "id" });
      if (!error) upsertedPlayers += batch.length;
      else errors.push(`Sheet player upsert: ${error.message}`);
    }
    counts.players = upsertedPlayers;

    // Build last game rows
    const lgRows = dataRows.map((row) => {
      const col = (i: number) => row[i] ?? "";
      const { opp, home_away } = parseOpp(col(35));
      const aPts = euInt(col(36)), hPts = euInt(col(37));
      let result: string | null = null;
      if (aPts > 0 || hPts > 0) {
        if (home_away === "H") result = hPts > aPts ? "W" : "L";
        else if (home_away === "A") result = aPts > hPts ? "W" : "L";
      }
      return {
        player_id: euInt(col(0)), game_date: normDate(col(34)),
        opp, home_away, result,
        a_pts: aPts, h_pts: hPts, mp: euInt(col(38)),
        pts: euInt(col(39)), reb: euInt(col(41)), ast: euInt(col(40)),
        stl: euInt(col(43)), blk: euInt(col(42)),
        fp: euNum(col(45)), nba_game_url: nullable(col(44)),
        updated_at: new Date().toISOString(),
      };
    }).filter((lg) => lg.game_date);

    let upsertedLastGames = 0;
    for (let i = 0; i < lgRows.length; i += 50) {
      const batch = lgRows.slice(i, i + 50);
      const { error } = await sb.from("player_last_game").upsert(batch, { onConflict: "player_id" });
      if (!error) upsertedLastGames += batch.length;
      else errors.push(`Sheet last game upsert: ${error.message}`);
    }
    counts.last_games = upsertedLastGames;

    console.log(`[nba-sync] Sheet fallback: ${upsertedPlayers} players, ${upsertedLastGames} last games`);
  } catch (sheetErr) {
    const msg = sheetErr instanceof Error ? sheetErr.message : String(sheetErr);
    errors.push(`Sheet fallback failed: ${msg}`);
    console.error("[nba-sync] Sheet fallback error:", msg);
  }
}

// ─── PERGAME + LAST5 ────────────────────────────────────────────────

async function syncPerGameAndLast5(
  sb: ReturnType<typeof createClient>,
  season: string,
  force: boolean,
  counts: Record<string, number>,
  errors: string[],
  updateStep: (step: string) => Promise<void>
) {
  await updateStep("FETCHING_PERGAME");
  console.log("[nba-sync] Fetching PerGame stats...");

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

  // Fetch league game log for last 5 computation
  await updateStep("FETCHING_GAME_LOGS");
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

  // Build player upsert rows
  await updateStep("UPSERTING_PLAYERS");
  const playerRows: any[] = [];
  for (const row of perGameRows) {
    const pid = row.PLAYER_ID as number;
    const mpg = (row.MIN as number) ?? 0;
    const pts = (row.PTS as number) ?? 0;
    const ast = (row.AST as number) ?? 0;
    const reb = (row.REB as number) ?? 0;
    const stl = (row.STL as number) ?? 0;
    const blk = (row.BLK as number) ?? 0;
    const fp = computeFP(pts, reb, ast, stl, blk);
    const stocks = stl + blk;

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

    playerRows.push({
      id: pid,
      name: row.PLAYER_NAME as string,
      team: row.TEAM_ABBREVIATION as string,
      gp: (row.GP as number) ?? 0,
      mpg: round2(mpg), pts: round2(pts), ast: round2(ast),
      reb: round2(reb), stl: round2(stl), blk: round2(blk),
      fp_pg_t: round2(fp),
      mpg5, pts5, ast5, reb5, stl5, blk5,
      fp_pg5: fp5, stocks, stocks5, delta_mpg, delta_fp,
      updated_at: new Date().toISOString(),
    });
  }

  // Upsert players in batches
  const BATCH = 100;
  let upserted = 0;
  for (let i = 0; i < playerRows.length; i += BATCH) {
    const batch = playerRows.slice(i, i + BATCH);
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

  // Compute value/value5 in bulk
  await updateStep("COMPUTING_VALUES");
  const { data: playersWithSalary } = await sb
    .from("players")
    .select("id, fp_pg_t, fp_pg5, salary")
    .gt("salary", 0);

  if (playersWithSalary && playersWithSalary.length > 0) {
    const valueUpdates = playersWithSalary.map((p) => ({
      id: p.id,
      value_t: round2(p.fp_pg_t / p.salary),
      value5: round2(p.fp_pg5 / p.salary),
    }));
    // Batch upsert value updates
    for (let i = 0; i < valueUpdates.length; i += BATCH) {
      const batch = valueUpdates.slice(i, i + BATCH);
      await sb.from("players").upsert(batch, { onConflict: "id", ignoreDuplicates: false });
    }
  }

  // Upsert only last 10 game logs per player (not entire season)
  await updateStep("UPSERTING_GAME_LOGS");
  const gameLogRows: any[] = [];
  const logsLimited = new Map<number, number>();
  for (const log of allGameLogs) {
    const pid = log.PLAYER_ID as number;
    const cnt = logsLimited.get(pid) ?? 0;
    if (cnt >= 10) continue;
    logsLimited.set(pid, cnt + 1);

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
      player_id: pid, game_id: gameId,
      game_date: normalizeDate(log.GAME_DATE as string),
      matchup, opp, home_away,
      mp: (log.MIN as number) ?? 0,
      pts, reb, ast, stl, blk,
      fp: computeFP(pts, reb, ast, stl, blk),
      nba_game_url: buildGameUrl(matchup, gameId),
      updated_at: new Date().toISOString(),
    });
  }

  let logCount = 0;
  for (let i = 0; i < gameLogRows.length; i += BATCH) {
    const batch = gameLogRows.slice(i, i + BATCH);
    const { error } = await sb.from("player_game_logs").upsert(batch, {
      onConflict: "player_id,game_id",
      ignoreDuplicates: false,
    });
    if (error) errors.push(`Game log upsert batch ${i}: ${error.message}`);
    else logCount += batch.length;
  }
  counts.game_logs = logCount;
}

// ─── LAST GAME ──────────────────────────────────────────────────────

async function syncLastGame(
  sb: ReturnType<typeof createClient>,
  season: string,
  counts: Record<string, number>,
  errors: string[],
  updateStep: (step: string) => Promise<void>
) {
  await updateStep("FETCHING_LAST_GAME");
  console.log("[nba-sync] Fetching last game data...");

  const playerLogSets = await nbaFetch("leaguegamelog", {
    Season: season,
    SeasonType: "Regular Season",
    PlayerOrTeam: "P",
    Direction: "DESC",
    Sorter: "DATE",
    LeagueID: "00",
  });

  const allLogs = playerLogSets[0]?.rows ?? [];
  console.log(`[nba-sync] Player logs: ${allLogs.length}`);

  const lastGameByPlayer = new Map<number, any>();
  for (const log of allLogs) {
    const pid = log.PLAYER_ID as number;
    if (!lastGameByPlayer.has(pid)) lastGameByPlayer.set(pid, log);
  }

  await updateStep("FETCHING_TEAM_SCORES");
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
    if (matchup) g.nba_game_url = buildGameUrl(matchup, gameId);
    if (matchup.includes("@")) { g.away_team = teamAbbr; g.away_pts = pts; }
    else { g.home_team = teamAbbr; g.home_pts = pts; }
  }

  // Upsert games
  await updateStep("UPSERTING_GAMES");
  const gamesArr = Array.from(gamesMap.values()).map(g => ({ ...g, updated_at: new Date().toISOString() }));
  const BATCH = 100;
  let gameCount = 0;
  for (let i = 0; i < gamesArr.length; i += BATCH) {
    const batch = gamesArr.slice(i, i + BATCH);
    const { error } = await sb.from("games").upsert(batch, { onConflict: "game_id", ignoreDuplicates: false });
    if (error) errors.push(`Games upsert batch ${i}: ${error.message}`);
    else gameCount += batch.length;
  }
  counts.games = gameCount;

  // Upsert player_last_game
  await updateStep("UPSERTING_LAST_GAMES");
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
    const game = gamesMap.get(gameId);
    const a_pts = game?.away_pts ?? 0;
    const h_pts = game?.home_pts ?? 0;
    let result: string | null = null;
    if (a_pts > 0 || h_pts > 0) {
      if (home_away === "H") result = h_pts > a_pts ? "W" : "L";
      else result = a_pts > h_pts ? "W" : "L";
    }

    lastGameRows.push({
      player_id: pid, game_date: normalizeDate(log.GAME_DATE as string),
      opp, home_away, result, a_pts, h_pts,
      mp: (log.MIN as number) ?? 0,
      pts, reb, ast, stl, blk, fp,
      nba_game_url: game?.nba_game_url ?? buildGameUrl(matchup, gameId),
      updated_at: new Date().toISOString(),
    });
  }

  let lastGameCount = 0;
  for (let i = 0; i < lastGameRows.length; i += BATCH) {
    const batch = lastGameRows.slice(i, i + BATCH);
    const { error } = await sb.from("player_last_game").upsert(batch, { onConflict: "player_id", ignoreDuplicates: false });
    if (error) errors.push(`Last game upsert batch ${i}: ${error.message}`);
    else lastGameCount += batch.length;
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
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  try {
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}
