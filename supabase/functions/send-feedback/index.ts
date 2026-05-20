import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const FEEDBACK_TO = "alertadetalento@gmail.com";
const FEEDBACK_FROM = "Hoops Fantasy Feedback <onboarding@resend.dev>";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function section(label: string, color: string, text: string): string {
  if (!text.trim()) return "";
  return `
    <tr><td style="padding:14px 0 6px;">
      <div style="font:600 11px/1 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;letter-spacing:0.18em;text-transform:uppercase;color:${color};">${esc(label)}</div>
    </td></tr>
    <tr><td style="padding:0 0 10px;">
      <div style="font:400 14px/1.55 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#111;white-space:pre-wrap;">${esc(text)}</div>
    </td></tr>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "MISSING_KEY", message: "RESEND_API_KEY not configured" } }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const issues = String(body?.issues ?? "").slice(0, 5000);
    const suggestions = String(body?.suggestions ?? "").slice(0, 5000);
    const loved = String(body?.loved ?? "").slice(0, 5000);
    const route = String(body?.route ?? "/").slice(0, 200);
    const routeLabel = String(body?.routeLabel ?? route).slice(0, 200);

    if (!issues.trim() && !suggestions.trim() && !loved.trim()) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "EMPTY", message: "Feedback is empty" } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Best-effort user lookup (don't fail if anon)
    let userEmail = "anonymous";
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const sb = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data } = await sb.auth.getClaims(authHeader.replace("Bearer ", ""));
        if (data?.claims?.email) userEmail = String(data.claims.email);
      } catch { /* ignore */ }
    }

    const subject = `Hoops Fantasy Manager Feedback — ${routeLabel}`;
    const sentAt = new Date().toISOString();

    const html = `<!doctype html><html><body style="margin:0;background:#f5f5f4;padding:24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="600" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e7e5e4;">
        <tr><td style="background:linear-gradient(135deg,#0a0a0a 0%,#1c1917 100%);padding:22px 28px;">
          <div style="font:700 11px/1 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;letter-spacing:0.32em;text-transform:uppercase;color:#FACC15;">Hoops Fantasy Manager</div>
          <div style="font:800 22px/1.15 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;letter-spacing:0.04em;text-transform:uppercase;color:#fff;margin-top:6px;">New feedback received</div>
          <div style="font:400 12px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#a8a29e;margin-top:6px;">from <strong style="color:#fff;">${esc(userEmail)}</strong> · ${esc(routeLabel)}</div>
        </td></tr>
        <tr><td style="padding:18px 28px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${section("Issues / Errors", "#dc2626", issues)}
            ${section("Suggestions", "#ca8a04", suggestions)}
            ${section("Loved it", "#059669", loved)}
          </table>
          <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e7e5e4;font:400 11px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#78716c;">
            Route: ${esc(route)} · Sent: ${esc(sentAt)}
          </div>
        </td></tr>
      </table>
    </body></html>`;

    const textParts: string[] = [`Hoops Fantasy Manager Feedback`, `From: ${userEmail}`, `Route: ${routeLabel} (${route})`, ``];
    if (issues.trim()) textParts.push(`=== ISSUES / ERRORS ===`, issues, ``);
    if (suggestions.trim()) textParts.push(`=== SUGGESTIONS ===`, suggestions, ``);
    if (loved.trim()) textParts.push(`=== LOVED IT ===`, loved, ``);
    textParts.push(`Sent: ${sentAt}`);

    const payload: Record<string, unknown> = {
      from: FEEDBACK_FROM,
      to: [FEEDBACK_TO],
      subject,
      html,
      text: textParts.join("\n"),
    };
    if (userEmail && userEmail.includes("@")) payload.reply_to = userEmail;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: "RESEND_FAILED", message: json?.message ?? "Email provider error", details: json } }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, data: { id: json?.id ?? null } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: { code: "INTERNAL", message: err instanceof Error ? err.message : "Unexpected error" } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});