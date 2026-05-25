import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: { code: "METHOD_NOT_ALLOWED" } });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { ok: false, error: { code: "UNAUTHORIZED" } });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return json(401, { ok: false, error: { code: "UNAUTHORIZED" } });
  }

  const expected = Deno.env.get("COMMISSIONER_ACCESS_PASSWORD");
  if (!expected) {
    return json(500, { ok: false, error: { code: "NOT_CONFIGURED", message: "COMMISSIONER_ACCESS_PASSWORD is not set." } });
  }

  let body: { password?: unknown };
  try { body = await req.json(); } catch { return json(400, { ok: false, error: { code: "BAD_JSON" } }); }
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) return json(400, { ok: false, error: { code: "MISSING_PASSWORD" } });

  if (!timingSafeEqual(password, expected)) {
    return json(401, { ok: false, error: { code: "INVALID_PASSWORD", message: "Incorrect password." } });
  }

  return json(200, { ok: true });
});
