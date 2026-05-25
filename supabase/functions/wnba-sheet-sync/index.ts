import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { requireAdmin } from "../_shared/admin-guard.ts";

/**
 * WNBA Google Sheets Sync — manual, on-demand.
 *
 * Modes:
 *   - inspect         : returns headers + sample rows (diagnostic)
 *   - players         : DB_Players → players (WNBA-scoped). Salary IGNORED.
 *   - schedule        : Schedule → schedule_games (WNBA-scoped)
 *   - game-data       : Player_Games_byGameday_data → player_game_logs +
 *                       player_last_game + season/last5 aggregates
 *   - advanced-stats  : Players_AdvStats_Season_Accum → players adv columns
 *   - all             : runs players → schedule → game-data → advanced-stats
 *
 * Required env: GOOGLE_SERVICE_ACCOUNT_JSON, WNBA_GSHEET_ID,
 *               SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_API_SECRET
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

function ok(data: unknown) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(code: string, message: string, status = 400) {
  return new Response(
    JSON.stringify({ ok: false, data: null, error: { code, message } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ── Google Sheets auth (service account JWT) ──
function b64url(u: Uint8Array): string {
  let s = ""; for (const b of u) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function strB64(s: string): string { return b64url(new TextEncoder().encode(s)); }

// deno-lint-ignore no-explicit-any
async function createJwt(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = strB64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = strB64(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600, iat: now,
  }));
  const unsigned = `${header}.${claim}`;
  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const bin = Uint8Array.from(atob(pem), (c: string) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", bin,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key,
    new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(new Uint8Array(sig))}`;
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
  const d = await res.json();
  if (!d.access_token) throw new Error(`Token error: ${JSON.stringify(d)}`);
  return d.access_token;
}

async function fetchTab(tab: string, range: string, token: string): Promise<string[][]> {
  const sheetId = Deno.env.get("WNBA_GSHEET_ID");
  if (!sheetId) throw new Error("WNBA_GSHEET_ID not set");
  const fullRange = `'${tab}'!${range}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${fullRange}?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets API ${res.status} on '${tab}': ${await res.text()}`);
  const data = await res.json();
  return (data.values || []) as string[][];
}

const TABS = [
  { key: "schedule",       tab: "Schedule",                       range: "A1:Z6"  },
  { key: "game-data",      tab: "Player_Games_byGameday_data",    range: "A1:AZ6" },
  { key: "advanced-stats", tab: "Players_AdvStats_Season_Accum",  range: "A1:AZ6" },
  { key: "players",        tab: "DB_Players",                     range: "A1:AZ6" },
] as const;

// ── helpers ──
function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s || /^tbd$/i.test(s)) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
function intOrZero(v: unknown): number { return Math.round(num(v)); }
function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : null;
}
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = typeof v === "number" ? String(v) : String(v).trim().replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
function nullable(s: unknown): string | null {
  const v = String(s ?? "").trim();
  if (!v || v === "None" || v === "none" || /^tbd$/i.test(v)) return null;
  return v;
}
function normDate(raw: unknown): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const p = v.split("/");
  if (p.length === 3) {
    const [a, b, c] = p;
    if (parseInt(a) > 12) return `${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`;
    return `${c}-${a.padStart(2, "0")}-${b.padStart(2, "0")}`;
  }
  return null;
}
function normTime(raw: unknown): string | null {
  let t = String(raw ?? "").trim();
  if (!t) return null;
  t = t.replace(/\s*(UTC|GMT|Z|[+-]\d{1,2}(:\d{2})?)\s*/gi, "").trim();
  const m = t.match(/^(\d{1,2}:\d{2})/);
  if (!m) return null;
  const r = m[1];
  return /^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(r) ? r : null;
}
/**
 * Preserve LIVE status strings ("Q1 5:29", "HALF", "OT 2:14", etc.) so the UI
 * can display the actual game state. Only collapse to FINAL/SCHEDULED at the
 * extremes. Having a score is NOT enough to mark FINAL (live games have scores).
 */
function normalizeStatus(raw: unknown, _hp?: number, _ap?: number): string {
  const s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "SCHEDULED";
  if (s.startsWith("FINAL")) return "FINAL";
  if (s.startsWith("SCHEDULED") || s === "TBD") return "SCHEDULED";
  // Live indicators from source sheet: "Q1 5:29", "Q2", "HALF", "HALFTIME",
  // "OT 2:14", "END Q3", etc. — keep the raw string (trimmed, length-capped).
  if (/^(Q[1-4]|END|HALF|OT|PRE|DELAY|LIVE|IN[ _]PROGRESS)/.test(s)) {
    return s.slice(0, 32);
  }
  return "SCHEDULED";
}
function lisbonWallClockToUtcIso(date: string, hhmm: string): string {
  const naiveUtc = new Date(`${date}T${hhmm}:00Z`);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(naiveUtc).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  const lisbonAsMs = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute),
  );
  const offsetMin = (lisbonAsMs - naiveUtc.getTime()) / 60000;
  return new Date(naiveUtc.getTime() - offsetMin * 60000).toISOString();
}
function calcAge(dob: string | null): number {
  if (!dob) return 0;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function makeSb() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
async function getWnbaLeagueId(sb: ReturnType<typeof makeSb>): Promise<string> {
  const { data, error } = await sb.from("leagues").select("id").eq("code", "wnba").maybeSingle();
  if (error || !data?.id) throw new Error(`WNBA league not found: ${error?.message ?? "missing row"}`);
  return data.id as string;
}

// ── per-mode handlers ──

async function syncPlayers(token: string, sb: ReturnType<typeof makeSb>, leagueId: string) {
  // DB_Players: A URL, B ID, C PHOTO, D NAME, E TEAM, F FC_BC,
  //             G $ (IGNORED), H # jersey, I COLLEGE, J WEIGHT, K HEIGHT,
  //             L AGE, M DOB, N EXP, O POS, P NAT (nationality, WNBA only)
  const rows = await fetchTab("DB_Players", "A1:P5000", token);
  const header = (rows[0] ?? []).map((s) => String(s).trim().toUpperCase());
  if (header[1] !== "ID" || header[3] !== "NAME") {
    throw new Error(`DB_Players HEADER_MISMATCH (got: ${header.slice(0, 6).join("|")})`);
  }
  const data = rows.slice(1).filter((r) => r.length > 0 && String(r[1] ?? "").trim() !== "");

  // SALARY (column G / r[6]) is intentionally never read from the sheet and never
  // written by this sync. Existing DB values are preserved by omitting `salary`
  // from the upsert payload; new rows fall back to the column default.
  const ids = data.map((r) => intOrZero(r[1])).filter((n) => n > 0);
  const { data: existing } = await sb
    .from("players").select("id, name").eq("league_id", leagueId)
    .in("id", ids.length ? ids : [-1]);
  const existingName = new Map<number, string>(
    (existing ?? []).map((p: { id: number; name: string | null }) => [p.id, String(p.name ?? "")]),
  );

  let upserted = 0; let skipped = 0;
  const errors: string[] = [];
  const BATCH = 100;
  for (let i = 0; i < data.length; i += BATCH) {
    const batch = data.slice(i, i + BATCH);
    const payload = batch.map((r) => {
      const id = intOrZero(r[1]);
      if (id <= 0) return null;
      const dob = normDate(r[12]);
      const sheetAge = intOrZero(r[11]);
      const age = sheetAge > 0 ? sheetAge : calcAge(dob);
      let name = String(r[3] ?? "").trim();
      if (/\?/.test(name) && existingName.get(id)) name = existingName.get(id)!;
      const rawNat = nullable(r[15]);
      const nationality = rawNat
        ? (rawNat.trim().toUpperCase() === "USA" ? "United States" : rawNat.trim())
        : null;
      return {
        id,
        league_id: leagueId,
        source_league: "wnba",
        source_player_id: String(id),
        source_url: nullable(r[0]),
        nba_url: nullable(r[0]),
        photo: nullable(r[2]),
        name,
        team: String(r[4] ?? "").trim(),
        fc_bc: String(r[5] ?? "FC").trim().toUpperCase() === "BC" ? "BC" : "FC",
        // r[6] = $ (salary) — DELIBERATELY NOT INCLUDED. Do not add it back.
        jersey: intOrZero(r[7]),
        college: nullable(r[8]),
        weight: intOrZero(r[9]),
        height: nullable(r[10]),
        age,
        dob,
        exp: intOrZero(r[13]),
        pos: nullable(r[14]),
        nationality,
        updated_at: new Date().toISOString(),
      };
    }).filter((r): r is NonNullable<typeof r> => r !== null);
    if (payload.length === 0) { skipped += batch.length; continue; }
    const { error } = await sb.from("players").upsert(payload, { onConflict: "id" });
    if (error) errors.push(`batch ${i}: ${error.message}`);
    else upserted += payload.length;
  }
  return { tab: "DB_Players", rows_read: data.length, upserted, skipped, errors };
}

// WNBA salary formula (mirrors wnba-salary-recalc): rookie → $4.5M, max-exp → $25M,
// linear interpolation in between. Applied here only to NEW players (salary=0/NULL)
// so that freshly synced players land with a calculated $ instead of TBD.
const WNBA_SAL_MIN = 4.5;
const WNBA_SAL_MAX = 25;
function parseExpForSalary(raw: unknown): number {
  if (raw == null) return 0;
  const s = String(raw).trim().toUpperCase();
  if (s === "" || s === "R" || s === "ROOKIE") return 0;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
async function backfillNewWnbaSalaries(sb: ReturnType<typeof makeSb>, leagueId: string) {
  // Compute league-wide max exp so the interpolation matches wnba-salary-recalc.
  const { data: allRows, error: allErr } = await sb
    .from("players").select("id, exp, salary").eq("league_id", leagueId);
  if (allErr) return { backfilled: 0, errors: [allErr.message] };
  let maxExp = 0;
  for (const p of allRows ?? []) {
    const e = parseExpForSalary((p as any).exp);
    if (e > maxExp) maxExp = e;
  }
  const newOnes = (allRows ?? []).filter((p: any) => !Number(p.salary));
  let backfilled = 0; const errors: string[] = [];
  for (const p of newOnes) {
    const e = parseExpForSalary((p as any).exp);
    const salary = maxExp <= 0
      ? WNBA_SAL_MIN
      : Math.round((WNBA_SAL_MIN + (e / maxExp) * (WNBA_SAL_MAX - WNBA_SAL_MIN)) * 10) / 10;
    const { error: upErr } = await sb.from("players")
      .update({ salary, value_t: 0, value5: 0, updated_at: new Date().toISOString() })
      .eq("id", (p as any).id).eq("league_id", leagueId);
    if (upErr) errors.push(`#${(p as any).id}: ${upErr.message}`);
    else backfilled++;
  }
  return { backfilled, max_exp: maxExp, errors };
}

async function syncSchedule(token: string, sb: ReturnType<typeof makeSb>, leagueId: string) {
  // Schedule: A Week B Day C Date D DayName E Time F Home G Away H Status
  //           I HomeScore J AwayScore K GameID L GameURL
  //           M GameRecap N GameBoxScore O GameCharts P GamePlayByPlay
  const rows = await fetchTab("Schedule", "A1:P5000", token);
  const header = (rows[0] ?? []).map((s) => String(s).trim().toUpperCase());
  if (!header[10]?.includes("GAME") || !header[2]?.includes("DATE")) {
    throw new Error(`Schedule HEADER_MISMATCH (got: ${header.slice(0, 12).join("|")})`);
  }
  const data = rows.slice(1).filter((r) => String(r[10] ?? "").trim() !== "");
  const games: Record<string, unknown>[] = [];
  const errors: string[] = [];
  for (let idx = 0; idx < data.length; idx++) {
    const r = data[idx];
    try {
      const gameId = String(r[10]).trim();
      const isoDate = normDate(r[2]);
      const time = normTime(r[4]);
      const hp = intOrZero(r[8]);
      const ap = intOrZero(r[9]);
      const status = normalizeStatus(r[7], hp, ap);
      const tipoff_utc = isoDate && time
        ? lisbonWallClockToUtcIso(isoDate, time)
        : (isoDate ? `${isoDate}T00:00:00+00:00` : null);
      games.push({
        game_id: gameId,
        league_id: leagueId,
        gw: intOrZero(r[0]) || 1,
        day: intOrZero(r[1]) || 1,
        tipoff_utc,
        home_team: String(r[5] ?? "").trim(),
        away_team: String(r[6] ?? "").trim(),
        home_pts: hp,
        away_pts: ap,
        status,
        nba_game_url: nullable(r[11]),
        game_recap_url: nullable(r[12]),
        game_boxscore_url: nullable(r[13]),
        game_charts_url: nullable(r[14]),
        game_playbyplay_url: nullable(r[15]),
      });
    } catch (e) {
      errors.push(`row #${idx + 2}: ${(e as Error).message}`);
    }
  }
  let upserted = 0;
  const BATCH = 200;
  for (let i = 0; i < games.length; i += BATCH) {
    const batch = games.slice(i, i + BATCH);
    const { error } = await sb.from("schedule_games").upsert(batch, { onConflict: "game_id" });
    if (error) errors.push(`batch ${i}: ${error.message}`);
    else upserted += batch.length;
  }
  return { tab: "Schedule", rows_read: data.length, upserted, skipped: 0, errors };
}

async function syncGameData(token: string, sb: ReturnType<typeof makeSb>, leagueId: string) {
  // Player_Games_byGameday_data:
  // A Week B Day C Date D DayName E Time F Home G Away
  // H HomeScore I AwayScore J Status K GameID L PlayerID M PlayerName
  // N PTS(=FP) O MP P PS Q R R A S B T S   (cols U-W ignored)
  const rows = await fetchTab("Player_Games_byGameday_data", "A1:T20000", token);
  const header = (rows[0] ?? []).map((s) => String(s).trim().toUpperCase());
  if (!header[10]?.includes("GAME") || header[11] !== "ID") {
    throw new Error(`Game-data HEADER_MISMATCH (got: ${header.slice(0, 14).join("|")})`);
  }
  const data = rows.slice(1).filter((r) => String(r[11] ?? "").trim() !== "");

  // League-scoped player team map (for home_away resolution)
  const { data: players } = await sb.from("players").select("id, team").eq("league_id", leagueId);
  const teamById = new Map<number, string>(
    (players ?? []).map((p: { id: number; team: string }) => [p.id, p.team]),
  );

  const errors: string[] = [];
  const skippedPlayers: Array<{ id: number; name: string }> = [];
  const gamesMap = new Map<string, Record<string, unknown>>();
  const playerLogs: Record<string, unknown>[] = [];

  for (let idx = 0; idx < data.length; idx++) {
    const r = data[idx];
    try {
      const gameId = String(r[10]).trim();
      const playerId = intOrZero(r[11]);
      const playerName = String(r[12] ?? "").trim();
      if (!gameId || playerId <= 0) continue;

      const isoDate = normDate(r[2]);
      const time = normTime(r[4]);
      const hp = intOrZero(r[7]);
      const ap = intOrZero(r[8]);
      const status = normalizeStatus(r[9], hp, ap);
      const homeTeam = String(r[5] ?? "").trim();
      const awayTeam = String(r[6] ?? "").trim();

      if (!gamesMap.has(gameId)) {
        const tipoff_utc = isoDate && time
          ? lisbonWallClockToUtcIso(isoDate, time)
          : (isoDate ? `${isoDate}T00:00:00+00:00` : null);
        gamesMap.set(gameId, {
          game_id: gameId,
          league_id: leagueId,
          gw: intOrZero(r[0]) || 1,
          day: intOrZero(r[1]) || 1,
          tipoff_utc,
          home_team: homeTeam,
          away_team: awayTeam,
          home_pts: hp,
          away_pts: ap,
          status,
        });
      }

      const playerTeam = teamById.get(playerId);
      if (!playerTeam) {
        skippedPlayers.push({ id: playerId, name: playerName });
        continue;
      }
      const home_away = playerTeam === homeTeam ? "H" : "A";
      const opp = home_away === "H" ? awayTeam : homeTeam;
      playerLogs.push({
        player_id: playerId,
        game_id: gameId,
        game_date: isoDate,
        mp: intOrZero(r[14]),
        pts: intOrZero(r[15]),  // PS = points scored
        reb: intOrZero(r[16]),
        ast: intOrZero(r[17]),
        blk: intOrZero(r[18]),
        stl: intOrZero(r[19]),
        fp:  num(r[13]),         // PTS (col N) = fantasy points
        home_away,
        opp,
        matchup: home_away === "H" ? `vs ${opp}` : `@ ${opp}`,
        league_id: leagueId,
      });
    } catch (e) {
      errors.push(`row #${idx + 2}: ${(e as Error).message}`);
    }
  }

  // Upsert games (skeleton — schedule sync owns the URL fields)
  const games = Array.from(gamesMap.values());
  if (games.length > 0) {
    const { error } = await sb.from("schedule_games").upsert(games, { onConflict: "game_id" });
    if (error) errors.push(`games upsert: ${error.message}`);
  }

  // Upsert logs
  let logsUpserted = 0;
  const BATCH = 200;
  for (let i = 0; i < playerLogs.length; i += BATCH) {
    const batch = playerLogs.slice(i, i + BATCH);
    const { error } = await sb.from("player_game_logs").upsert(batch, { onConflict: "player_id,game_id" });
    if (error) errors.push(`logs batch ${i}: ${error.message}`);
    else logsUpserted += batch.length;
  }

  // Refresh player_last_game + season/last5 aggregates per player
  const playerIds = [...new Set(playerLogs.map((l) => l.player_id as number))];
  let lastGameUpdated = 0;
  let aggregatesUpdated = 0;
  for (const pid of playerIds) {
    const { data: logs } = await sb
      .from("player_game_logs")
      .select("mp,pts,reb,ast,stl,blk,fp,game_date,opp,home_away,game_id,nba_game_url")
      .eq("player_id", pid).eq("league_id", leagueId)
      .order("game_date", { ascending: false });
    if (!logs || logs.length === 0) continue;

    const latest = logs[0];
    const { data: gameInfo } = await sb
      .from("schedule_games")
      .select("home_team, away_team, home_pts, away_pts, game_recap_url, game_boxscore_url, game_charts_url, game_playbyplay_url, nba_game_url")
      .eq("game_id", latest.game_id).eq("league_id", leagueId).maybeSingle();
    let result: string | null = null;
    let hPts = 0, aPts = 0;
    if (gameInfo) {
      hPts = gameInfo.home_pts ?? 0;
      aPts = gameInfo.away_pts ?? 0;
      if (hPts > 0 || aPts > 0) {
        result = latest.home_away === "H"
          ? (hPts > aPts ? "W" : "L")
          : (aPts > hPts ? "W" : "L");
      }
    }
    const { error: lgErr } = await sb.from("player_last_game").upsert({
      player_id: pid, league_id: leagueId,
      game_date: latest.game_date, opp: latest.opp, home_away: latest.home_away,
      result, h_pts: hPts, a_pts: aPts,
      mp: latest.mp, pts: latest.pts, reb: latest.reb, ast: latest.ast,
      stl: latest.stl, blk: latest.blk, fp: latest.fp,
      nba_game_url: gameInfo?.nba_game_url ?? null,
      game_recap_url: gameInfo?.game_recap_url ?? null,
      game_boxscore_url: gameInfo?.game_boxscore_url ?? null,
      game_charts_url: gameInfo?.game_charts_url ?? null,
      game_playbyplay_url: gameInfo?.game_playbyplay_url ?? null,
    }, { onConflict: "player_id" });
    if (!lgErr) lastGameUpdated++;

    const avg = (arr: Array<Record<string, unknown>>, k: string) =>
      arr.length ? arr.reduce((s, r) => s + Number(r[k] ?? 0), 0) / arr.length : 0;
    const last5 = logs.slice(0, 5);
    const { error: aggErr } = await sb.from("players").update({
      gp: logs.length,
      mpg: avg(logs, "mp"), pts: avg(logs, "pts"), reb: avg(logs, "reb"),
      ast: avg(logs, "ast"), stl: avg(logs, "stl"), blk: avg(logs, "blk"),
      fp_pg_t: avg(logs, "fp"),
      mpg5: avg(last5, "mp"), pts5: avg(last5, "pts"), reb5: avg(last5, "reb"),
      ast5: avg(last5, "ast"), stl5: avg(last5, "stl"), blk5: avg(last5, "blk"),
      fp_pg5: avg(last5, "fp"),
    }).eq("id", pid).eq("league_id", leagueId);
    if (!aggErr) aggregatesUpdated++;
  }

  return {
    tab: "Player_Games_byGameday_data",
    rows_read: data.length,
    upserted: logsUpserted,
    skipped: skippedPlayers.length,
    games_upserted: games.length,
    last_game_updated: lastGameUpdated,
    players_aggregated: aggregatesUpdated,
    skipped_players: skippedPlayers.length ? skippedPlayers.slice(0, 25) : undefined,
    errors,
  };
}

async function syncAdvancedStats(token: string, sb: ReturnType<typeof makeSb>, leagueId: string) {
  // A ID B NAME C TEAM D FGM E FGA F FG_PCT G 3PM H 3PA I 3P_PCT
  // J FTM K FTA L FT_PCT M OREB N DREB O TOV P PF Q PLUS_MINUS
  const rows = await fetchTab("Players_AdvStats_Season_Accum", "A1:Q5000", token);
  const header = (rows[0] ?? []).map((s) => String(s).trim().toUpperCase());
  if (header[0] !== "ID" || header[1] !== "NAME") {
    throw new Error(`AdvStats HEADER_MISMATCH (got: ${header.slice(0, 5).join("|")})`);
  }
  const data = rows.slice(1).filter((r) => String(r[0] ?? "").trim() !== "");
  let updated = 0; let skipped = 0;
  const errors: string[] = [];

  for (const r of data) {
    const id = intOrNull(r[0]);
    if (!id || id <= 0) { skipped++; continue; }
    const patch = {
      fgm: intOrNull(r[3]),  fga: intOrNull(r[4]),  fg_pct: numOrNull(r[5]),
      tpm: intOrNull(r[6]),  tpa: intOrNull(r[7]),  tp_pct: numOrNull(r[8]),
      ftm: intOrNull(r[9]),  fta: intOrNull(r[10]), ft_pct: numOrNull(r[11]),
      oreb: intOrNull(r[12]), dreb: intOrNull(r[13]),
      tov: intOrNull(r[14]), pf: intOrNull(r[15]), plus_minus: intOrNull(r[16]),
      updated_at: new Date().toISOString(),
    };
    const { data: res, error } = await sb
      .from("players").update(patch).eq("id", id).eq("league_id", leagueId).select("id");
    if (error) errors.push(`id=${id}: ${error.message}`);
    else if ((res?.length ?? 0) > 0) updated++;
    else skipped++;
  }

  return {
    tab: "Players_AdvStats_Season_Accum",
    rows_read: data.length,
    upserted: updated, skipped, nulled_out: 0, errors,
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authFail = requireAdmin(req);
  if (authFail) return authFail;

  if (req.method !== "POST") return err("METHOD_NOT_ALLOWED", "POST only", 405);

  let body: { mode?: string; tab?: string } = {};
  try { body = await req.json(); } catch { /* default */ }
  const mode = body.mode ?? "inspect";

  try {
    if (mode === "inspect") {
      const token = await getAccessToken();
      const out: Record<string, { headers: string[]; samples: string[][]; error?: string }> = {};
      for (const t of TABS) {
        try {
          const rows = await fetchTab(t.tab, t.range, token);
          out[t.key] = {
            headers: rows[0] ?? [],
            samples: rows.slice(1, 4),
          };
        } catch (e) {
          out[t.key] = { headers: [], samples: [], error: (e as Error).message };
        }
      }
      return ok({ mode, sheet_id: Deno.env.get("WNBA_GSHEET_ID"), tabs: out });
    }

    const t0 = Date.now();
    const token = await getAccessToken();
    const sb = makeSb();
    const leagueId = await getWnbaLeagueId(sb);

    if (mode === "players") {
      const r = await syncPlayers(token, sb, leagueId);
      return ok({ mode, elapsed_ms: Date.now() - t0, ...r });
    }
    if (mode === "schedule") {
      const r = await syncSchedule(token, sb, leagueId);
      return ok({ mode, elapsed_ms: Date.now() - t0, ...r });
    }
    if (mode === "game-data") {
      const r = await syncGameData(token, sb, leagueId);
      return ok({ mode, elapsed_ms: Date.now() - t0, ...r });
    }
    if (mode === "advanced-stats") {
      const r = await syncAdvancedStats(token, sb, leagueId);
      return ok({ mode, elapsed_ms: Date.now() - t0, ...r });
    }
    if (mode === "all") {
      const players = await syncPlayers(token, sb, leagueId);
      const schedule = await syncSchedule(token, sb, leagueId);
      const gameData = await syncGameData(token, sb, leagueId);
      const adv = await syncAdvancedStats(token, sb, leagueId);
      return ok({
        mode, elapsed_ms: Date.now() - t0,
        results: { players, schedule, "game-data": gameData, "advanced-stats": adv },
      });
    }

    return err("UNKNOWN_MODE", `mode='${mode}' is not supported`, 400);
  } catch (e) {
    console.error("[wnba-sheet-sync]", e);
    return err("INTERNAL", (e as Error).message, 500);
  }
});
