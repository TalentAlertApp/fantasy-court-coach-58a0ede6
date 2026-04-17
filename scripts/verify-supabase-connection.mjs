/**
 * Verify Supabase connection for this project.
 *
 * Run with:
 *   node --env-file-if-exists=/vercel/share/.env.project scripts/verify-supabase-connection.mjs
 *
 * All values are read from the project's environment (no project-specific
 * details are hardcoded here). The script picks the first URL / publishable
 * key it finds across the usual env var names and derives the project ref
 * from the URL.
 *
 * Checks:
 *  1. URL + anon key in env are self-consistent
 *  2. REST endpoint answers for a few expected tables with the anon key
 *  3. Edge Functions endpoint `/functions/v1/health` answers
 *  4. If a service-role key is present, confirm it works against the DB
 */

const SUPABASE_URL = (
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/['"]/g, "").replace(/\/+$/, "");

const PUBLISHABLE_KEY = (
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ""
).replace(/['"]/g, "");

if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
  console.error(
    "Missing env. Expected VITE_SUPABASE_URL (or SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL) and VITE_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)."
  );
  process.exit(1);
}

// Reject accidentally-used secret keys in the "publishable" slot
if (PUBLISHABLE_KEY.startsWith("sb_secret_")) {
  console.error(
    "Resolved publishable key starts with 'sb_secret_'. That is a SERVER-ONLY key. " +
      "Fix VITE_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY to hold the publishable (anon) key instead."
  );
  process.exit(1);
}

// Derive the expected project ref from the URL
const urlMatch = SUPABASE_URL.match(/^https?:\/\/([^.]+)\.supabase\.co/i);
const EXPECTED_REF = urlMatch ? urlMatch[1] : "";

const envSecret =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  // Fallback: if VITE_SUPABASE_ANON_KEY was (mis)configured as a secret key, use it server-side only
  (process.env.VITE_SUPABASE_ANON_KEY && process.env.VITE_SUPABASE_ANON_KEY.replace(/['"]/g, "").startsWith("sb_secret_")
    ? process.env.VITE_SUPABASE_ANON_KEY
    : "");

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
  console.log(`Project ref (from URL): ${EXPECTED_REF || "(unknown)"}`);
  console.log(`Using URL:              ${SUPABASE_URL}`);
  console.log("");

  // 1. If the publishable key is a JWT, decode it and confirm it matches the URL's ref
  if (PUBLISHABLE_KEY.startsWith("eyJ")) {
    const decoded = decodeJwtRef(PUBLISHABLE_KEY);
    if (!decoded) {
      line("publishable key is not a valid JWT", "warn");
    } else if (decoded.role !== "anon") {
      line(`publishable key role is "${decoded.role}", expected "anon"`, "fail", JSON.stringify(decoded));
      failed++;
    } else if (EXPECTED_REF && decoded.ref !== EXPECTED_REF) {
      line(
        "publishable key belongs to a different project than the URL",
        "fail",
        `url=${EXPECTED_REF} key=${decoded.ref}`
      );
      failed++;
    } else {
      line(`publishable key is anon JWT for ref=${decoded.ref}`, "ok");
    }
  } else if (PUBLISHABLE_KEY.startsWith("sb_publishable_")) {
    line("publishable key uses new sb_publishable_ format", "ok");
  } else {
    line("publishable key in unrecognized format", "warn", PUBLISHABLE_KEY.slice(0, 12) + "…");
  }

  // 4. Try a small query against a known table — if RLS blocks anon, we still expect 200 with []
  const probeTables = ["teams", "players", "schedule_games"];
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

  // 7. Server-side confirmation: if we have a secret key in env, probe a real table with it
  if (envSecret) {
    const secret = envSecret.replace(/['"]/g, "");
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/teams?select=id&limit=1`, {
        headers: { apikey: secret, Authorization: `Bearer ${secret}` },
      });
      if (r.ok) {
        line("service-role key works against teams table", "ok", `HTTP ${r.status}`);
      } else {
        line(`service-role key HTTP ${r.status}`, "warn", (await r.text()).slice(0, 160));
      }
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
