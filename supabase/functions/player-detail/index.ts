import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function ok(data: unknown) {
  return new Response(JSON.stringify({ ok: true, data }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function err(code: string, message: string, details: string | null = null, status = 400) {
  return new Response(JSON.stringify({ ok: false, data: null, error: { code, message, details } }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Sheets helpers (inlined) ──
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
// deno-lint-ignore no-explicit-any
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
  const saJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON"); if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set");
  const sheetId = Deno.env.get("GSHEET_ID"); if (!sheetId) throw new Error("GSHEET_ID not set");
  const token = await getAccessToken(JSON.parse(saJson));
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Sheets ${r.status}: ${await r.text()}`);
  const d = await r.json(); return (d.values || []) as string[][];
}
// deno-lint-ignore no-explicit-any
function rowToPlayer(row: string[]): any {
  const col = (i: number) => row[i] ?? "";
  const salary = euNum(col(5)), fpT = euNum(col(21)), valueT = euNum(col(23)), fp5 = euNum(col(31)), value5 = euNum(col(33));
  const mpg = euNum(col(15)), mpg5 = euNum(col(25)), stl = euNum(col(20)), blk = euNum(col(19)), stl5 = euNum(col(30)), blk5 = euNum(col(29));
  const { opp, home_away } = parseOpp(col(35));
  const aPts = euInt(col(36)), hPts = euInt(col(37));
  const fcBc = col(4).trim().toUpperCase();
  let result: string | null = null;
  if (aPts > 0 || hPts > 0) { if (home_away === "H") result = hPts > aPts ? "W" : "L"; else if (home_away === "A") result = aPts > hPts ? "W" : "L"; }
  return {
    core: { id: euInt(col(0)), name: col(2), team: col(3), fc_bc: fcBc === "BC" ? "BC" : "FC", photo: nullable(col(1)), salary, jersey: euInt(col(6)), pos: nullable(col(13)), height: nullable(col(9)), weight: euInt(col(8)), age: euInt(col(10)), dob: normDate(col(11)), exp: euInt(col(12)), college: nullable(col(7)) },
    season: { gp: euInt(col(14)), mpg, pts: euNum(col(16)), reb: euNum(col(18)), ast: euNum(col(17)), stl, blk, fp: fpT },
    last5: { mpg5, pts5: euNum(col(26)), reb5: euNum(col(28)), ast5: euNum(col(27)), stl5, blk5, fp5 },
    lastGame: { date: normDate(col(34)), opp, home_away, result, a_pts: aPts, h_pts: hPts, mp: euInt(col(38)), pts: euInt(col(39)), reb: euInt(col(41)), ast: euInt(col(40)), stl: euInt(col(43)), blk: euInt(col(42)), fp: euNum(col(45)), nba_game_url: nullable(col(44)) },
    computed: { value: valueT, value5, stocks: stl + blk, stocks5: stl5 + blk5, delta_mpg: mpg5 - mpg, delta_fp: fp5 - fpT },
    flags: { injury: null, note: null },
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const playerId = Number(url.searchParams.get("id"));
    if (!playerId) return err("MISSING_PARAM", "id query param required");
    const rows = await fetchSheetRows();
    const dataRows = rows.slice(1).filter((r) => r[0] && r[0].trim() !== "");
    const allPlayers = dataRows.map(rowToPlayer);
    // deno-lint-ignore no-explicit-any
    const player = allPlayers.find((p: any) => p.core.id === playerId);
    if (!player) return err("NOT_FOUND", `Player ${playerId} not found`, null, 404);
    return ok({ player, history: [], upcoming: [] });
  } catch (e) {
    console.error("Player detail error:", e);
    return err("PLAYER_DETAIL_ERROR", e instanceof Error ? e.message : "Unknown error", null, 500);
  }
});
