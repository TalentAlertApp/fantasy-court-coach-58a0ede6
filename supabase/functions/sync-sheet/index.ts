import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { requireAdmin } from "../_shared/admin-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function ok(data: unknown) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(code: string, message: string, details: string | null = null, status = 400) {
  return new Response(
    JSON.stringify({ ok: false, data: null, error: { code, message, details } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ── Google Sheets auth ──
function base64url(input: Uint8Array): string {
  let binary = "";
  for (const byte of input) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function strToB64(str: string): string {
  return base64url(new TextEncoder().encode(str));
}
// deno-lint-ignore no-explicit-any
async function createJwt(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = strToB64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = strToB64(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600, iat: now,
  }));
  const unsigned = `${header}.${claim}`;
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c: string) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key,
    new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64url(new Uint8Array(sig))}`;
}

async function getAccessToken(): Promise<string> {
  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const sa = JSON.parse(saJson);
  const jwt = await createJwt(sa);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function fetchSheetTab(sheetName: string, range: string, token: string): Promise<string[][]> {
  const sheetId = Deno.env.get("GSHEET_ID");
  if (!sheetId) throw new Error("GSHEET_ID not set");
  const fullRange = `'${sheetName}'!${range}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(fullRange)}?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.values || []) as string[][];
}

function toNum(v: string | undefined | null): number {
  if (!v || v.trim() === "" || v === "-") return 0;
  return Number(v.replace(",", ".")) || 0;
}
function toInt(v: string | undefined | null): number {
  return Math.round(toNum(v));
}

// ── FP Formula: FP = PS + R + 2*A + 3*S + 3*B ──
// Sheet columns: PTS(N)=FP, MP(O), PS(P)=points scored, R(Q)=reb, A(R)=ast, B(S)=blk, S(T)=stl
function computeFP(ps: number, r: number, a: number, b: number, s: number): number {
  return ps + r + (2 * a) + (3 * s) + (3 * b);
}

// ── SALARY SYNC ──
// deno-lint-ignore no-explicit-any
async function syncSalaries(supabase: any, token: string): Promise<{ updated: number; recalculated: number }> {
  // Salary tab: ID(A), Player(B), Team(C), Salary(D)
  const rows = await fetchSheetTab("Salary", "A:D", token);
  const dataRows = rows.slice(1).filter(r => r[0] && r[0].trim() !== "");

  let updated = 0;
  let recalculated = 0;

  for (let i = 0; i < dataRows.length; i += 50) {
    const batch = dataRows.slice(i, i + 50);
    for (const row of batch) {
      const playerId = toInt(row[0]);
      const salary = toNum(row[3]);
      if (!playerId) continue;

      // Update salary only
      const { error } = await supabase.from("players")
        .update({ salary, updated_at: new Date().toISOString() })
        .eq("id", playerId);

      if (!error) {
        updated++;
        // Recalc value_t and value5
        if (salary > 0) {
          const { data: player } = await supabase.from("players")
            .select("fp_pg_t, fp_pg5")
            .eq("id", playerId)
            .single();
          if (player) {
            const value_t = Number(player.fp_pg_t) / salary;
            const value5 = Number(player.fp_pg5) / salary;
            await supabase.from("players")
              .update({ value_t, value5 })
              .eq("id", playerId);
            recalculated++;
          }
        } else {
          await supabase.from("players")
            .update({ value_t: 0, value5: 0 })
            .eq("id", playerId);
          recalculated++;
        }
      }
    }
  }

  return { updated, recalculated };
}

// ── GAMES SYNC ──
// FP tab rows 1-2000: finished games with player stats
// Columns: Week(A0), Day(B1), Date(C2), DayName(D3), Time(E4), HomeTeam(F5), AwayTeam(G6),
//          HomeScore(H7), AwayScore(I8), Status(J9), GameID(K10), PlayerID(L11), Player(M12),
//          PTS(N13)=FP, MP(O14), PS(P15)=pts scored, R(Q16)=reb, A(R17)=ast, B(S18)=blk, S(T19)=stl
// deno-lint-ignore no-explicit-any
async function syncGames(supabase: any, token: string): Promise<{ games: number; game_logs: number; players_updated: number }> {
  const rows = await fetchSheetTab("FP", "A:T", token);
  const dataRows = rows.slice(1).filter(r => r[10] && r[10].trim() !== ""); // Must have Game ID

  // Only finished games (rows 1-2000 area)
  const finishedRows = dataRows.filter(r => {
    const status = (r[9] || "").trim().toLowerCase();
    return status === "finished" || status === "final";
  });

  // 1. Upsert unique games
  // deno-lint-ignore no-explicit-any
  const gamesMap = new Map<string, any>();
  for (const row of finishedRows) {
    const gameId = row[10].trim();
    if (!gamesMap.has(gameId)) {
      gamesMap.set(gameId, {
        game_id: gameId,
        game_date: row[2] || null,
        home_team: row[5] || null,
        away_team: row[6] || null,
        home_team_abbr: row[5] || null,
        away_team_abbr: row[6] || null,
        home_pts: toInt(row[7]),
        away_pts: toInt(row[8]),
        status: "FINAL",
        updated_at: new Date().toISOString(),
      });
    }
  }

  let gamesUpserted = 0;
  const gamesBatch = Array.from(gamesMap.values());
  for (let i = 0; i < gamesBatch.length; i += 50) {
    const batch = gamesBatch.slice(i, i + 50);
    const { error } = await supabase.from("games").upsert(batch, { onConflict: "game_id" });
    if (!error) gamesUpserted += batch.length;
    else console.error("Games upsert error:", error);
  }

  // 2. Upsert player game logs
  let logsUpserted = 0;
  // deno-lint-ignore no-explicit-any
  const logRows: any[] = [];
  for (const row of finishedRows) {
    const playerId = toInt(row[11]);
    const gameId = row[10].trim();
    if (!playerId || !gameId) continue;

    const ps = toInt(row[15]); // Points scored
    const reb = toInt(row[16]);
    const ast = toInt(row[17]);
    const blk = toInt(row[18]);
    const stl = toInt(row[19]);
    const fp = computeFP(ps, reb, ast, blk, stl);

    // Determine home/away
    const homeTeam = (row[5] || "").trim();
    const awayTeam = (row[6] || "").trim();

    logRows.push({
      player_id: playerId,
      game_id: gameId,
      game_date: row[2] || null,
      mp: toInt(row[14]),
      pts: ps,
      reb,
      ast,
      blk,
      stl,
      fp,
      opp: null, // Will be set below
      home_away: null, // Will be set below
      matchup: `${awayTeam} @ ${homeTeam}`,
      updated_at: new Date().toISOString(),
    });
  }

  // We need to determine which team each player is on to set home_away and opp
  // First, get all player teams from DB
  const playerIds = [...new Set(logRows.map(l => l.player_id))];
  // deno-lint-ignore no-explicit-any
  const playerTeamMap = new Map<number, string>();
  if (playerIds.length > 0) {
    for (let i = 0; i < playerIds.length; i += 100) {
      const batch = playerIds.slice(i, i + 100);
      const { data: players } = await supabase.from("players")
        .select("id, team")
        .in("id", batch);
      if (players) {
        // deno-lint-ignore no-explicit-any
        for (const p of players as any[]) {
          playerTeamMap.set(p.id, p.team);
        }
      }
    }
  }

  // Set home_away and opp for each log
  for (const log of logRows) {
    const playerTeam = playerTeamMap.get(log.player_id);
    const game = gamesMap.get(log.game_id);
    if (playerTeam && game) {
      if (playerTeam === game.home_team_abbr) {
        log.home_away = "H";
        log.opp = game.away_team_abbr;
      } else {
        log.home_away = "A";
        log.opp = game.home_team_abbr;
      }
    }
  }

  // Upsert logs in batches - use player_id + game_id as unique
  for (let i = 0; i < logRows.length; i += 50) {
    const batch = logRows.slice(i, i + 50);
    const { error } = await supabase.from("player_game_logs").upsert(batch, {
      onConflict: "player_id,game_id",
    });
    if (!error) logsUpserted += batch.length;
    else console.error("Game logs upsert error:", error);
  }

  // 3. Recompute player aggregates from game logs
  let playersUpdated = 0;
  for (const playerId of playerIds) {
    try {
      // Get all game logs for this player, ordered by date desc
      const { data: logs } = await supabase.from("player_game_logs")
        .select("*")
        .eq("player_id", playerId)
        .order("game_date", { ascending: false });

      if (!logs || logs.length === 0) continue;

      const gp = logs.length;
      const totalMp = logs.reduce((s: number, l: { mp: number }) => s + Number(l.mp), 0);
      const totalPts = logs.reduce((s: number, l: { pts: number }) => s + Number(l.pts), 0);
      const totalReb = logs.reduce((s: number, l: { reb: number }) => s + Number(l.reb), 0);
      const totalAst = logs.reduce((s: number, l: { ast: number }) => s + Number(l.ast), 0);
      const totalStl = logs.reduce((s: number, l: { stl: number }) => s + Number(l.stl), 0);
      const totalBlk = logs.reduce((s: number, l: { blk: number }) => s + Number(l.blk), 0);
      const totalFp = logs.reduce((s: number, l: { fp: number }) => s + Number(l.fp), 0);

      const mpg = gp > 0 ? totalMp / gp : 0;
      const pts = gp > 0 ? totalPts / gp : 0;
      const reb = gp > 0 ? totalReb / gp : 0;
      const ast = gp > 0 ? totalAst / gp : 0;
      const stl = gp > 0 ? totalStl / gp : 0;
      const blk = gp > 0 ? totalBlk / gp : 0;
      const fp_pg_t = gp > 0 ? totalFp / gp : 0;

      // Last 5
      const last5 = logs.slice(0, 5);
      const gp5 = last5.length;
      const mpg5 = gp5 > 0 ? last5.reduce((s: number, l: { mp: number }) => s + Number(l.mp), 0) / gp5 : 0;
      const pts5 = gp5 > 0 ? last5.reduce((s: number, l: { pts: number }) => s + Number(l.pts), 0) / gp5 : 0;
      const reb5 = gp5 > 0 ? last5.reduce((s: number, l: { reb: number }) => s + Number(l.reb), 0) / gp5 : 0;
      const ast5 = gp5 > 0 ? last5.reduce((s: number, l: { ast: number }) => s + Number(l.ast), 0) / gp5 : 0;
      const stl5 = gp5 > 0 ? last5.reduce((s: number, l: { stl: number }) => s + Number(l.stl), 0) / gp5 : 0;
      const blk5 = gp5 > 0 ? last5.reduce((s: number, l: { blk: number }) => s + Number(l.blk), 0) / gp5 : 0;
      const fp_pg5 = gp5 > 0 ? last5.reduce((s: number, l: { fp: number }) => s + Number(l.fp), 0) / gp5 : 0;

      // Get current salary for value calc
      const { data: currentPlayer } = await supabase.from("players")
        .select("salary")
        .eq("id", playerId)
        .single();
      const salary = currentPlayer ? Number(currentPlayer.salary) : 0;

      const update = {
        gp, mpg: Math.round(mpg * 100) / 100,
        pts: Math.round(pts * 100) / 100, reb: Math.round(reb * 100) / 100,
        ast: Math.round(ast * 100) / 100, stl: Math.round(stl * 100) / 100,
        blk: Math.round(blk * 100) / 100, fp_pg_t: Math.round(fp_pg_t * 100) / 100,
        mpg5: Math.round(mpg5 * 100) / 100,
        pts5: Math.round(pts5 * 100) / 100, reb5: Math.round(reb5 * 100) / 100,
        ast5: Math.round(ast5 * 100) / 100, stl5: Math.round(stl5 * 100) / 100,
        blk5: Math.round(blk5 * 100) / 100, fp_pg5: Math.round(fp_pg5 * 100) / 100,
        stocks: Math.round((stl + blk) * 100) / 100,
        stocks5: Math.round((stl5 + blk5) * 100) / 100,
        delta_mpg: Math.round((mpg5 - mpg) * 100) / 100,
        delta_fp: Math.round((fp_pg5 - fp_pg_t) * 100) / 100,
        value_t: salary > 0 ? Math.round((fp_pg_t / salary) * 100) / 100 : 0,
        value5: salary > 0 ? Math.round((fp_pg5 / salary) * 100) / 100 : 0,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("players").update(update).eq("id", playerId);
      if (!error) playersUpdated++;
      else console.error(`Player ${playerId} update error:`, error);

      // Also update player_last_game with the most recent game
      const lastLog = logs[0];
      if (lastLog) {
        const lastGame = gamesMap.get(lastLog.game_id);
        let result: string | null = null;
        if (lastGame) {
          const isHome = lastLog.home_away === "H";
          if (lastGame.home_pts > 0 || lastGame.away_pts > 0) {
            if (isHome) result = lastGame.home_pts > lastGame.away_pts ? "W" : "L";
            else result = lastGame.away_pts > lastGame.home_pts ? "W" : "L";
          }
        }

        const lgRow = {
          player_id: playerId,
          game_date: lastLog.game_date,
          opp: lastLog.opp,
          home_away: lastLog.home_away,
          result,
          a_pts: lastGame ? lastGame.away_pts : 0,
          h_pts: lastGame ? lastGame.home_pts : 0,
          mp: Number(lastLog.mp),
          pts: Number(lastLog.pts),
          reb: Number(lastLog.reb),
          ast: Number(lastLog.ast),
          stl: Number(lastLog.stl),
          blk: Number(lastLog.blk),
          fp: Number(lastLog.fp),
          nba_game_url: lastLog.nba_game_url || null,
          updated_at: new Date().toISOString(),
        };

        await supabase.from("player_last_game").upsert(lgRow, { onConflict: "player_id" });
      }
    } catch (e) {
      console.error(`Error computing aggregates for player ${playerId}:`, e);
    }
  }

  // 4. Detect new players and team changes
  // Check if any player_id in logs doesn't exist in players table
  for (const row of finishedRows) {
    const playerId = toInt(row[11]);
    const playerName = row[12] || "";
    if (!playerId || !playerName) continue;

    if (!playerTeamMap.has(playerId)) {
      // New player - create stub
      const game = gamesMap.get(row[10]);
      const homeTeam = game?.home_team_abbr || "";
      const awayTeam = game?.away_team_abbr || "";
      // We don't know which team - just pick one; user can edit in Commissioner
      const team = homeTeam || awayTeam || "UNK";

      await supabase.from("players").upsert({
        id: playerId,
        name: playerName,
        team,
        fc_bc: "FC", // default, user can fix
        note: "NEW - auto-created from game data",
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

      playerTeamMap.set(playerId, team);
      console.log(`New player created: ${playerName} (${playerId})`);
    }
  }

  return { games: gamesUpserted, game_logs: logsUpserted, players_updated: playersUpdated };
}

// ── SCHEDULE SYNC ──
// FP tab rows 2001+: scheduled games (no player stats)
// deno-lint-ignore no-explicit-any
async function syncSchedule(supabase: any, token: string): Promise<{ schedule_games: number }> {
  // Fetch all rows - schedule games are after row 2000
  const rows = await fetchSheetTab("FP", "A:T", token);
  const allDataRows = rows.slice(1); // skip header

  // Include ALL rows with a valid game ID (finished or scheduled, with or without player data).
  // We dedup by game_id below so multiple player-stat rows for the same game produce one schedule entry.
  const scheduleRows = allDataRows.filter(r => {
    const gameId = (r[10] || "").trim();
    return !!gameId;
  });

  // deno-lint-ignore no-explicit-any
  const scheduleGames: any[] = [];
  const seen = new Set<string>();

  for (const row of scheduleRows) {
    const gameId = row[10].trim();
    if (seen.has(gameId)) continue;
    seen.add(gameId);

    const week = toInt(row[0]);
    const day = toInt(row[1]);
    const dateStr = (row[2] || "").trim();
    const timeStr = (row[4] || "").trim();

    // Build tipoff_utc from date + time (time is Lisbon time)
    let tipoff_utc: string | null = null;
    if (dateStr && timeStr) {
      try {
        // dateStr is YYYY-MM-DD, timeStr is HH:MM (Lisbon time)
        // Approximate: Lisbon is UTC+0 in winter, UTC+1 in summer
        // For now just store as UTC approximation
        tipoff_utc = `${dateStr}T${timeStr}:00+00:00`;
      } catch {
        // ignore
      }
    }

    const rawStatus = (row[9] || "").trim().toLowerCase();
    const mappedStatus = (rawStatus === "finished" || rawStatus === "final") ? "FINAL" : "SCHEDULED";

    scheduleGames.push({
      game_id: gameId,
      gw: week || 1,
      day: day || 1,
      home_team: (row[5] || "").trim(),
      away_team: (row[6] || "").trim(),
      home_pts: toInt(row[7]),
      away_pts: toInt(row[8]),
      status: mappedStatus,
      tipoff_utc,
      nba_game_url: null,
    });
  }

  let upserted = 0;
  for (let i = 0; i < scheduleGames.length; i += 50) {
    const batch = scheduleGames.slice(i, i + 50);
    const { error } = await supabase.from("schedule_games").upsert(batch, { onConflict: "game_id" });
    if (!error) upserted += batch.length;
    else console.error("Schedule upsert error:", error);
  }

  return { schedule_games: upserted };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authFail = requireAdmin(req);
  if (authFail) return authFail;

  try {
    const body = req.method === "POST" ? await req.json() : {};
    const type: string = (body.type || "FULL").toUpperCase();

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = await getAccessToken();

    // Create sync_runs record
    const { data: run } = await supabase.from("sync_runs").insert({
      type,
      status: "RUNNING",
      started_at: new Date().toISOString(),
    }).select("id").single();

    const runId = run?.id;
    // deno-lint-ignore no-explicit-any
    const counts: Record<string, any> = {};
    const errors: string[] = [];

    try {
      if (type === "SALARY" || type === "FULL") {
        try {
          const salaryResult = await syncSalaries(supabase, token);
          counts.salary_updated = salaryResult.updated;
          counts.salary_recalculated = salaryResult.recalculated;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown salary sync error";
          errors.push(`SALARY: ${msg}`);
          console.error("Salary sync error:", e);
        }
      }

      if (type === "GAMES" || type === "FULL") {
        try {
          const gamesResult = await syncGames(supabase, token);
          counts.games = gamesResult.games;
          counts.game_logs = gamesResult.game_logs;
          counts.players_updated = gamesResult.players_updated;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown games sync error";
          errors.push(`GAMES: ${msg}`);
          console.error("Games sync error:", e);
        }
      }

      if (type === "SCHEDULE" || type === "FULL") {
        try {
          const scheduleResult = await syncSchedule(supabase, token);
          counts.schedule_games = scheduleResult.schedule_games;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown schedule sync error";
          errors.push(`SCHEDULE: ${msg}`);
          console.error("Schedule sync error:", e);
        }
      }

      // Update sync run
      const finalStatus = errors.length > 0 ? "PARTIAL" : "SUCCESS";
      if (runId) {
        await supabase.from("sync_runs").update({
          status: finalStatus,
          finished_at: new Date().toISOString(),
          details: { counts, errors },
        }).eq("id", runId);
      }

      return ok({
        run_id: runId,
        status: finalStatus,
        counts,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (e) {
      if (runId) {
        await supabase.from("sync_runs").update({
          status: "FAILED",
          finished_at: new Date().toISOString(),
          details: { counts, errors: [e instanceof Error ? e.message : "Unknown"] },
        }).eq("id", runId);
      }
      throw e;
    }
  } catch (e) {
    console.error("Sync error:", e);
    return err("SYNC_ERROR", e instanceof Error ? e.message : "Unknown error", null, 500);
  }
});
