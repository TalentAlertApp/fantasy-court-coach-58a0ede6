import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdmin } from "../_shared/admin-guard.ts";

/**
 * WNBA Google Sheets Sync — manual, on-demand.
 *
 * First iteration: implements `mode=inspect` which reads the first ~5 rows of
 * each known WNBA tab and returns headers + samples so we can map columns
 * deterministically before wiring real imports. Once verified, we'll add
 * `mode=schedule|game-data|advanced-stats|players|all` that transform rows
 * into the existing `import-*` payload shapes (with `league_code: "wnba"`).
 *
 * Required env: GOOGLE_SERVICE_ACCOUNT_JSON, WNBA_GSHEET_ID
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

    return err("NOT_IMPLEMENTED",
      `mode='${mode}' will be wired after column mapping is verified via mode=inspect.`, 501);
  } catch (e) {
    console.error("[wnba-sheet-sync]", e);
    return err("INTERNAL", (e as Error).message, 500);
  }
});
