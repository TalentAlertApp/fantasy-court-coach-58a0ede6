import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(code: string, message: string, details: string | null = null, status = 400) {
  return new Response(
    JSON.stringify({ ok: false, data: null, error: { code, message, details } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// ── European decimal parsing ──
function euNum(val: string | undefined | null): number {
  if (!val || val.trim() === "" || val === "-") return 0;
  return Number(val.replace(",", ".")) || 0;
}
function euInt(val: string | undefined | null): number {
  return Math.round(euNum(val));
}
function nullable(val: string | undefined | null): string | null {
  if (!val || val.trim() === "" || val === "None" || val === "none") return null;
  return val;
}
function normDate(val: string | undefined | null): string | null {
  if (!val || val.trim() === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const parts = val.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}
function parseOpp(val: string | undefined | null): { opp: string | null; home_away: "H" | "A" | null } {
  if (!val || val.trim() === "") return { opp: null, home_away: null };
  const t = val.trim();
  if (t.startsWith("@")) return { opp: t.slice(1), home_away: "A" };
  return { opp: t, home_away: "H" };
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

async function fetchSheetRows(range = "A:AV"): Promise<string[][]> {
  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const sheetId = Deno.env.get("GSHEET_ID");
  if (!sheetId) throw new Error("GSHEET_ID not set");
  const sa = JSON.parse(saJson);
  const jwt = await createJwt(sa);
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error(`Token error: ${JSON.stringify(tokenData)}`);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
  if (!res.ok) throw new Error(`Sheets API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.values || []) as string[][];
}

// deno-lint-ignore no-explicit-any
function rowToPlayer(row: string[]): any {
  const col = (i: number) => row[i] ?? "";
  const salary = euNum(col(5));
  const fpT = euNum(col(21));
  const valueT = euNum(col(23));
  const fp5 = euNum(col(31));
  const value5 = euNum(col(33));
  const mpg = euNum(col(15));
  const mpg5 = euNum(col(25));
  const stl = euNum(col(20));
  const blk = euNum(col(19));
  const stl5 = euNum(col(30));
  const blk5 = euNum(col(29));
  const { opp, home_away } = parseOpp(col(35));
  const aPts = euInt(col(36));
  const hPts = euInt(col(37));
  const fcBc = col(4).trim().toUpperCase();
  let result: string | null = null;
  if (aPts > 0 || hPts > 0) {
    if (home_away === "H") result = hPts > aPts ? "W" : "L";
    else if (home_away === "A") result = aPts > hPts ? "W" : "L";
  }

  return {
    core: {
      id: euInt(col(0)), name: col(2), team: col(3),
      fc_bc: (fcBc === "FC" || fcBc === "BC" ? fcBc : "FC"),
      photo: nullable(col(1)), salary, jersey: euInt(col(6)),
      pos: nullable(col(13)), height: nullable(col(9)),
      weight: euInt(col(8)), age: euInt(col(10)),
      dob: normDate(col(11)), exp: euInt(col(12)), college: nullable(col(7)),
    },
    season: {
      gp: euInt(col(14)), mpg, pts: euNum(col(16)), reb: euNum(col(18)),
      ast: euNum(col(17)), stl, blk, fp: fpT,
    },
    last5: {
      mpg5, pts5: euNum(col(26)), reb5: euNum(col(28)),
      ast5: euNum(col(27)), stl5, blk5, fp5,
    },
    lastGame: {
      date: normDate(col(34)), opp, home_away, result,
      a_pts: aPts, h_pts: hPts, mp: euInt(col(38)),
      pts: euInt(col(39)), reb: euInt(col(41)), ast: euInt(col(40)),
      stl: euInt(col(43)), blk: euInt(col(42)),
      fp: euNum(col(45)), nba_game_url: nullable(col(44)),
    },
    computed: {
      value: valueT, value5,
      stocks: stl + blk, stocks5: stl5 + blk5,
      delta_mpg: mpg5 - mpg, delta_fp: fp5 - fpT,
    },
    flags: { injury: null, note: null },
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const mode = Deno.env.get("DATA_SOURCE_MODE") || "sheet";
    const sort = url.searchParams.get("sort") || "salary";
    const order = url.searchParams.get("order") || "desc";
    const limit = Math.min(Number(url.searchParams.get("limit")) || 200, 500);
    const offset = Number(url.searchParams.get("offset")) || 0;
    const fcBcFilter = url.searchParams.get("fc_bc");
    const search = url.searchParams.get("search")?.toLowerCase();

    // deno-lint-ignore no-explicit-any
    let items: any[];

    if (mode === "sheet") {
      const rows = await fetchSheetRows();
      const dataRows = rows.slice(1).filter((r) => r[0] && r[0].trim() !== "");
      items = dataRows.map(rowToPlayer);
    } else {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: players, error } = await supabase.from("players").select("*");
      if (error) throw new Error(error.message);
      const { data: lastGames } = await supabase.from("player_last_game").select("*");
      // deno-lint-ignore no-explicit-any
      const lgMap = new Map((lastGames || []).map((lg: any) => [lg.player_id, lg]));
      // deno-lint-ignore no-explicit-any
      items = (players || []).map((p: any) => {
        // deno-lint-ignore no-explicit-any
        const lg: any = lgMap.get(p.id) || {};
        return {
          core: { id: p.id, name: p.name, team: p.team, fc_bc: p.fc_bc, photo: p.photo || null, salary: Number(p.salary), jersey: p.jersey, pos: p.pos || null, height: p.height || null, weight: p.weight, age: p.age, dob: p.dob || null, exp: p.exp, college: p.college || null },
          season: { gp: p.gp, mpg: Number(p.mpg), pts: Number(p.pts), reb: Number(p.reb), ast: Number(p.ast), stl: Number(p.stl), blk: Number(p.blk), fp: Number(p.fp_pg_t) },
          last5: { mpg5: Number(p.mpg5), pts5: Number(p.pts5), reb5: Number(p.reb5), ast5: Number(p.ast5), stl5: Number(p.stl5), blk5: Number(p.blk5), fp5: Number(p.fp_pg5) },
          lastGame: { date: lg.game_date || null, opp: lg.opp || null, home_away: lg.home_away || null, result: lg.result || null, a_pts: lg.a_pts || 0, h_pts: lg.h_pts || 0, mp: lg.mp || 0, pts: lg.pts || 0, reb: lg.reb || 0, ast: lg.ast || 0, stl: lg.stl || 0, blk: lg.blk || 0, fp: Number(lg.fp || 0), nba_game_url: lg.nba_game_url || null },
          computed: { value: Number(p.value_t), value5: Number(p.value5), stocks: Number(p.stl) + Number(p.blk), stocks5: Number(p.stl5) + Number(p.blk5), delta_mpg: Number(p.mpg5) - Number(p.mpg), delta_fp: Number(p.fp_pg5) - Number(p.fp_pg_t) },
          flags: { injury: p.injury || null, note: p.note || null },
        };
      });
    }

    // Filter
    // deno-lint-ignore no-explicit-any
    if (fcBcFilter) items = items.filter((p: any) => p.core.fc_bc === fcBcFilter.toUpperCase());
    // deno-lint-ignore no-explicit-any
    if (search) items = items.filter((p: any) => p.core.name.toLowerCase().includes(search) || p.core.team.toLowerCase().includes(search));

    const count = items.length;
    // deno-lint-ignore no-explicit-any
    const sortKeyMap: Record<string, (p: any) => number> = {
      salary: (p) => p.core.salary, fp: (p) => p.season.fp, fp5: (p) => p.last5.fp5,
      value: (p) => p.computed.value, value5: (p) => p.computed.value5,
      stocks5: (p) => p.computed.stocks5, delta_fp: (p) => p.computed.delta_fp,
      delta_mpg: (p) => p.computed.delta_mpg,
    };
    const sortFn = sortKeyMap[sort] || sortKeyMap.salary;
    // deno-lint-ignore no-explicit-any
    items.sort((a: any, b: any) => order === "asc" ? sortFn(a) - sortFn(b) : sortFn(b) - sortFn(a));
    const paged = items.slice(offset, offset + limit);

    return ok({ meta: { count, limit, offset, sort, order }, items: paged });
  } catch (e) {
    console.error("Players error:", e);
    return err("PLAYERS_FETCH_ERROR", e instanceof Error ? e.message : "Unknown error", null, 500);
  }
});
