// Image proxy: fetches NBA CDN images and re-serves with permissive CORS so
// html-to-image can rasterise them without canvas tainting. Same-origin to
// the Supabase project, no auth required.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const ALLOWED_HOSTS = new Set([
  "cdn.nba.com",
  "ak-static.cms.nba.com",
  "www.nba.com",
  "nba.com",
  "a.espncdn.com",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const url = new URL(req.url);
    const target = url.searchParams.get("url");
    if (!target) {
      return new Response(JSON.stringify({ error: "missing url param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let parsed: URL;
    try { parsed = new URL(target); }
    catch {
      return new Response(JSON.stringify({ error: "invalid url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return new Response(JSON.stringify({ error: "host not allowed", host: parsed.hostname }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const upstream = await fetch(parsed.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 hoopsfantasy-image-proxy" },
    });
    if (!upstream.ok || !upstream.body) {
      return new Response(JSON.stringify({ error: "upstream failed", status: upstream.status }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const contentType = upstream.headers.get("content-type") ?? "image/png";
    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});