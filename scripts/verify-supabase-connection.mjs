/**
 * Verify Supabase connection for this project.
 *
 * Run with:
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/verify-supabase-connection.mjs
 *
 * Checks:
 *  1. Env vars + URL match the expected project ref (jtewuekavaujgnynmpaq)
 *  2. REST endpoint answers with the publishable (anon) key
 *  3. Edge Functions endpoint `/functions/v1/health` answers
 *  4. A couple of expected tables respond to a lightweight HEAD/GET
 */

const EXPECTED_REF = "jtewuekavaujgnynmpaq";

// Hardcoded to match src/integrations/supabase/client.ts (single source of truth for the browser client)
const SUPABASE_URL = "https://jtewuekavaujgnynmpaq.supabase.co";
const PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0ZXd1ZWthdmF1amdueW5tcGFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzE2MTcsImV4cCI6MjA4ODEwNzYxN30.ooXNRN9p2EKJlnGNph6NXIZ9xw3QZQqyjKdBxFagroU";

const envUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const envSecret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function line(label, status, detail = "") {
  const badge = status === "ok" ? "  OK  " : status === "warn" ? " WARN " : " FAIL ";
  console.log(`[${badge}] ${label}${detail ? " — " + detail : ""}`);
}

function decodeJwtRef(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    return { ref: payload.ref, role: payload.role };
  } catch {
    return null;
  }
}

async function main() {
  let failed = 0;

  console.log("--- Supabase connection verification ---");
  console.log(`Target project ref: ${EXPECTED_REF}`);
  console.log(`Using URL:          ${SUPABASE_URL}`);
  console.log("");

  // 1. Env vars sanity check
  if (envUrl && envUrl.replace(/['"]/g, "") === SUPABASE_URL) {
    line("env VITE_SUPABASE_URL matches client URL", "ok");
  } else {
    line("env VITE_SUPABASE_URL mismatch", "warn", `env=${envUrl}`);
  }

  // 2. Decode the publishable key to confirm it belongs to the right project
  const decoded = decodeJwtRef(PUBLISHABLE_KEY);
  if (decoded && decoded.ref === EXPECTED_REF && decoded.role === "anon") {
    line(`publishable key is anon JWT for ref=${decoded.ref}`, "ok");
  } else {
    line("publishable key does not decode to expected ref/role", "fail", JSON.stringify(decoded));
    failed++;
  }

  // 3. Warn if VITE_SUPABASE_ANON_KEY in env is a secret key (common misconfig)
  const viteAnon = (process.env.VITE_SUPABASE_ANON_KEY || "").replace(/['"]/g, "");
  if (viteAnon.startsWith("sb_secret_")) {
    line(
      "VITE_SUPABASE_ANON_KEY is a SECRET key in env",
      "warn",
      "would be leaked to browser bundle if referenced in client code. Reset it to the publishable key (sb_p... or eyJ... anon JWT)."
    );
  } else if (viteAnon) {
    line("VITE_SUPABASE_ANON_KEY present in env", "ok");
  }

  // 4. REST endpoint liveness (PostgREST root returns Swagger)
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${PUBLISHABLE_KEY}` },
    });
    if (r.ok) {
      line("PostgREST /rest/v1/ responded", "ok", `HTTP ${r.status}`);
    } else {
      line("PostgREST /rest/v1/ non-OK", "fail", `HTTP ${r.status}`);
      failed++;
    }
  } catch (err) {
    line("PostgREST request failed", "fail", String(err));
    failed++;
  }

  // 5. Try a small query against a known table (teams) — if RLS blocks anon, we still expect 200 with []
  const probeTables = ["teams", "players", "schedule"];
  for (const table of probeTables) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
        headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${PUBLISHABLE_KEY}` },
      });
      const body = await r.text();
      if (r.ok) {
        const rows = JSON.parse(body);
        line(`table "${table}" reachable`, "ok", `returned ${Array.isArray(rows) ? rows.length : "?"} row(s)`);
      } else {
        // 401/403 with RLS is fine, means DB responded. 404 means table missing.
        const softFail = r.status === 401 || r.status === 403;
        line(
          `table "${table}" — HTTP ${r.status}`,
          softFail ? "warn" : "fail",
          body.slice(0, 160)
        );
        if (!softFail) failed++;
      }
    } catch (err) {
      line(`table "${table}" request failed`, "fail", String(err));
      failed++;
    }
  }

  // 6. Edge function probe — health is the lightest one referenced in src/lib/api.ts
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/health`, {
      headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${PUBLISHABLE_KEY}` },
    });
    if (r.status === 404) {
      line('edge function "health" not deployed', "warn", "deploy via `supabase functions deploy health`");
    } else if (r.ok) {
      line('edge function "health" reachable', "ok", `HTTP ${r.status}`);
    } else {
      line(`edge function "health" HTTP ${r.status}`, "warn", await r.text().then(t => t.slice(0, 160)));
    }
  } catch (err) {
    line("edge function request failed", "fail", String(err));
    failed++;
  }

  // 7. Server-side confirmation: list schema if we have a secret key (optional, won't fail build)
  if (envSecret) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/?select=*`, {
        headers: { apikey: envSecret.replace(/['"]/g, ""), Authorization: `Bearer ${envSecret.replace(/['"]/g, "")}` },
      });
      line("service-role REST reachable", r.ok ? "ok" : "warn", `HTTP ${r.status}`);
    } catch (err) {
      line("service-role REST failed", "warn", String(err));
    }
  }

  console.log("");
  if (failed === 0) {
    console.log("RESULT: connection looks healthy.");
    process.exit(0);
  } else {
    console.log(`RESULT: ${failed} check(s) failed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
